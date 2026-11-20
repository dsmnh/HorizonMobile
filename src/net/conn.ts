/**
 * App 平面多路复用连接（契约 1.6.0）：HELLO → AUTH（会话 token，HMAC）→ ACTIVE。
 * 单连接复用 REQ/SUB，断线指数退避重连并重订阅；传输经 Transport 注入。
 * TLS 模式下所有出帧置 0x02 并校验入帧一致性（§9.1），默认关闭。
 * 数据泵全局唯一、重连单飞、PING 定时器随连接生灭，避免并发写帧冲突。
 */
import { Frame, PROTOCOL_VERSION, T, FLAG_TLS_BOUND, encodeFrame, jsonFrame } from './protocol';
import { kidOf, sign } from './auth';

/** TLS 连接参数（契约 §9.1）；指纹为证书 SHA-256，允许带冒号。 */
export interface TlsOptions {
  enabled: boolean;
  certFingerprint?: string;
}

export interface Transport {
  connect(host: string, port: number, tls?: TlsOptions): Promise<void>;
  write(data: Buffer): void;
  onData(cb: (chunk: Buffer) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

export interface ConnOptions {
  host: string;
  port: number;
  /** 会话 token（account.register / account.login 签发）。 */
  token: string;
  app?: string;
  requestTimeoutMs?: number;
  backoffInitialMs?: number;
  backoffMaxMs?: number;
  /** 启用 TLS 外层；默认关闭，兼容现有明文 mock/e2e。 */
  tls?: boolean;
  /** 固定信任的证书 SHA-256 指纹；TLS 模式下必须匹配，否则断开。 */
  certFingerprint?: string;
  /** 终止性错误（指纹不匹配、flags 降级剥离）回调；此类错误不进入自动重连。 */
  onFatal?: (code: string) => void;
}

export interface Res<T = any> {
  ok: boolean;
  b: T;
  m?: string;
}

export interface TeamEvent {
  seq: number;
  k: string;
  [key: string]: any;
}

/** 订阅流：EventSource 形状（addEventListener / close），屏幕层与 SSE 写法一致。 */
export class Stream {
  readonly op: string;
  private handlers: ((e: TeamEvent) => void)[] = [];
  private fullHandlers: ((f: any) => void)[] = [];
  streamId = -1;
  sid = '';
  lastParams: any = {};

  constructor(op: string) {
    this.op = op;
  }

  addEventListener(cb: (e: TeamEvent) => void): void {
    this.handlers.push(cb);
  }

  onFull(cb: (f: any) => void): void {
    this.fullHandlers.push(cb);
  }

  close(): void {
    if (this.connRef) this.connRef.unsub(this.streamId);
    this.handlers = [];
    this.fullHandlers = [];
  }

  /** @internal */
  connRef?: HorizonConn;
  /** @internal */
  emit(f: any): void {
    if (f.t === 'f') {
      for (const cb of this.fullHandlers) cb(f);
      return;
    }
    if (f.t === 'd') {
      for (const e of f.events ?? []) {
        for (const cb of this.handlers) cb(e);
      }
    }
  }
}

interface Pending {
  resolve: (v: Res) => void;
  reject: (e: Error) => void;
  timer: any;
}

export class HorizonConn {
  private transport: Transport;
  private opts: ConnOptions;
  private buffer = Buffer.alloc(0);
  private pending = new Map<number, Pending>();
  private streams: Stream[] = [];
  private nextId = 0;
  private running = false;
  private authed = false;
  private nonce = '';
  private clockOffset = 0;
  private failCount = 0;
  /** 握手期一次性读帧 waiter；ACTIVE 期为 null，帧全部走 onFrame 分发。 */
  private handshakeWaiter: ((f: Frame) => void) | null = null;
  /** 握手期错误出口：flags 一致性失败时主动终止等待，避免握手悬挂。 */
  private handshakeFail: ((e: Error) => void) | null = null;
  /** 重连单飞标志：onDisconnected 可能被多次触发，只放行第一个。 */
  private reconnecting = false;
  /** 当前连接的 PING 定时器；断连即清。 */
  private pingTimer: any = null;
  private pumpInstalled = false;

  constructor(transport: Transport, opts: ConnOptions) {
    this.transport = transport;
    this.opts = {
      app: 'HorizonMobile/0.1.0',
      requestTimeoutMs: 20_000,
      backoffInitialMs: 1_000,
      backoffMaxMs: 15_000,
      ...opts,
    };
  }

  get isConnected(): boolean {
    return this.authed;
  }

  /** TLS 连接上所有出帧置 0x02；明文连接恒为 0（契约 §9.1）。 */
  private get frameFlags(): number {
    return this.opts.tls ? FLAG_TLS_BOUND : 0;
  }

  private tlsOptions(): TlsOptions | undefined {
    return this.opts.tls
      ? { enabled: true, certFingerprint: this.opts.certFingerprint }
      : undefined;
  }

  /** 启动连接与常驻重连循环；resolve 于首次鉴权成功，reject 于终止性错误（撤销/版本不兼容）。 */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    if (!this.pumpInstalled) {
      this.transport.onData((chunk) => this.pump(chunk));
      this.transport.onClose(() => this.onDisconnected());
      this.pumpInstalled = true;
    }
    let backoff = this.opts.backoffInitialMs!;
    while (this.running) {
      try {
        await this.handshakeAndAuth();
        this.authed = true;
        this.failCount = 0;
        await this.resubscribeAll();
        return;
      } catch (e: any) {
        if (e.terminal || !this.running) throw e;
        await sleep(backoff);
        backoff = Math.min(backoff * 2, this.opts.backoffMaxMs!);
      }
    }
  }

  /** 发送请求；断线期间 reject。 */
  async req(op: string, p: any = {}): Promise<Res> {
    if (!this.authed) throw new Error('未连接');
    const id = ++this.nextId;
    const promise = new Promise<Res>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`请求超时：${op}`));
      }, this.opts.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.transport.write(jsonFrame(T.REQ, { id, op, p }, this.frameFlags));
    return promise;
  }

  /** 订阅任意流（通用入口）；返回 Stream，streamId 由 SUB_OK 异步回填。 */
  subscribeStream(op: string, p: any = {}): Stream {
    const stream = new Stream(op);
    stream.connRef = this;
    this.streams.push(stream);
    if (this.authed) {
      this.rawSub(stream, p).catch(() => {
        // 订阅失败留待重连时补订
      });
    }
    return stream;
  }

  /** 订阅 team 流（1.0 的 App 平面仅登记该流）。 */
  subscribeTeam(uuid: string): Stream {
    return this.subscribeStream('team', { uuid });
  }

  private async rawSub(stream: Stream, p: any, sid?: string): Promise<void> {
    if (!this.authed) return; // 断连中的补订请求直接放弃，重连循环会接管
    stream.lastParams = p;
    const id = ++this.nextId;
    const frame: any = { id, op: stream.op, p };
    if (sid) frame.sid = sid;
    this.transport.write(jsonFrame(T.SUB, frame, this.frameFlags));
    // SUB_OK 由帧分发器按 id 完成；断连时 pending 被 reject，这里吞掉避免未捕获崩溃。
    const promise = new Promise<Res>((resolve) => {
      const timer = setTimeout(() => this.pending.delete(id), this.opts.requestTimeoutMs);
      this.pending.set(id, {
        resolve: (res) => {
          clearTimeout(timer);
          stream.streamId = res.b?.s ?? -1;
          stream.sid = res.b?.sid ?? '';
          resolve(res);
        },
        reject: () => clearTimeout(timer),
        timer,
      });
    });
    await promise.catch(() => undefined);
  }

  /** @internal */
  unsub(streamId: number): void {
    if (streamId < 0 || !this.authed) return;
    const frame: any = { s: streamId };
    this.transport.write(jsonFrame(T.UNSUB, frame, this.frameFlags));
  }

  close(): void {
    this.running = false;
    this.authed = false;
    this.stopPing();
    this.transport.close();
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('连接已关闭'));
    }
    this.pending.clear();
  }

  // ---------- 连接生命周期 ----------

  private async handshakeAndAuth(): Promise<void> {
    await this.transport.connect(this.opts.host, this.opts.port, this.tlsOptions());
    // 握手期无并发帧（服务端只回应答），一次性 waiter 从公共泵取帧
    const ack = await this.expectFrame(
      jsonFrame(T.HELLO, {
        v: PROTOCOL_VERSION,
        app: this.opts.app,
        plane: 'app',
      }, this.frameFlags),
    );
    if (ack.type === T.ERR) {
      throw terminal(jsonBody(ack).m ?? 'ERR');
    }
    const body = jsonBody(ack);
    if (body.v !== PROTOCOL_VERSION) {
      throw terminal(`VERSION_MISMATCH:server=${body.v}`);
    }
    this.nonce = body.nonce;
    this.clockOffset = body.time - nowSec();
    await this.authOnce();
    this.startPing();
  }

  private async authOnce(): Promise<void> {
    const ts = nowSec() + this.clockOffset;
    const sig = sign(this.opts.token, ts, this.nonce);
    const reply = await this.expectFrame(
      jsonFrame(T.AUTH, { kid: kidOf(this.opts.token), ts, sig }, this.frameFlags),
    );
    if (reply.type === T.AUTH_FAIL) {
      const body = jsonBody(reply);
      const code = body.code ?? 'AUTH_FAILED';
      if (code === 'CLOCK') {
        const serverTime = body.time ?? 0;
        if (serverTime > 0) this.clockOffset = serverTime - nowSec();
        // 按 §4.2 重签一次
        const ts2 = nowSec() + this.clockOffset;
        const retry = await this.expectFrame(
          jsonFrame(T.AUTH, {
            kid: kidOf(this.opts.token),
            ts: ts2,
            sig: sign(this.opts.token, ts2, this.nonce),
          }, this.frameFlags),
        );
        if (retry.type === T.AUTH_FAIL) {
          throw terminal(jsonBody(retry).code ?? 'AUTH_FAILED');
        }
        return;
      }
      throw terminal(code);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (!this.authed) {
        this.stopPing();
        return;
      }
      try {
        this.transport.write(encodeFrame(T.PING, undefined, this.frameFlags));
      } catch {
        this.stopPing();
      }
    }, 20_000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private async resubscribeAll(): Promise<void> {
    for (const stream of this.streams) {
      if (!this.authed) return; // 重订途中断线：交给重连循环
      try {
        await this.rawSub(stream, stream.lastParams ?? {}, stream.sid || undefined);
      } catch {
        // 单个流重订失败不阻断整体重连；该流由后续重连继续补订
      }
    }
  }

  /** 断连统一入口（传输 close 触发）；pending 清算 + 单飞重连。 */
  private onDisconnected(): void {
    const wasAuthed = this.authed;
    this.authed = false;
    this.stopPing();
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('连接断开'));
    }
    this.pending.clear();
    if (!this.running || this.reconnecting) return;
    if (!wasAuthed) return; // 首连循环尚未结束，由 start 的循环负责重试
    this.reconnecting = true;
    void this.reconnectLoop();
  }

  private async reconnectLoop(): Promise<void> {
    let backoff = this.opts.backoffInitialMs!;
    while (this.running && !this.authed) {
      try {
        await this.handshakeAndAuth();
        this.authed = true;
        this.reconnecting = false;
        await this.resubscribeAll();
        return;
      } catch (e: any) {
        if (e.terminal || !this.running) {
          this.reconnecting = false;
          return;
        }
        await sleep(backoff);
        backoff = Math.min(backoff * 2, this.opts.backoffMaxMs!);
      }
    }
    this.reconnecting = false;
  }

  // ---------- 帧泵与分发 ----------

  /** 全局唯一数据泵：握手帧交给 waiter，其余帧走分发。 */
  private pump(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.buffer.length < 4) return;
      const len = this.buffer.readUInt32BE(0);
      if (len < 2 || len > 16 * 1024 * 1024) {
        this.transport.close();
        return;
      }
      if (this.buffer.length < 4 + len) return;
      // len 已含 type+flags 两字节：raw = [4, 4+len)，残留从 4+len 起——多切 2 字节会吞掉同 chunk 下一帧
      // slice 而非 subarray：buffer 垫片的 subarray 返回裸 Uint8Array，缺 toString(encoding)
      const raw = this.buffer.slice(4, 4 + len);
      this.buffer = this.buffer.slice(4 + len);
      const frame: Frame = { type: raw[0], flags: raw[1], payload: raw.slice(2) };
      // 连接为 TLS ⇔ 帧带 0x02；不一致按 §9.1 断开，阻止降级剥离。
      if (((frame.flags & FLAG_TLS_BOUND) !== 0) !== !!this.opts.tls) {
        this.failFlags();
        return;
      }
      if (this.handshakeWaiter) {
        const deliver = this.handshakeWaiter;
        this.handshakeWaiter = null;
        deliver(frame);
      } else {
        this.onFrame(frame);
      }
    }
  }

  /** 读一帧的握手专用路径：写帧后挂一次性 waiter，由公共泵投递。 */
  private expectFrame(writeFrame: Buffer): Promise<Frame> {
    this.transport.write(writeFrame);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handshakeWaiter = null;
        this.handshakeFail = null;
        reject(new Error('握手超时'));
      }, 15_000);
      this.handshakeWaiter = (f: Frame) => {
        clearTimeout(timer);
        this.handshakeFail = null;
        resolve(f);
      };
      this.handshakeFail = (e: Error) => {
        clearTimeout(timer);
        this.handshakeWaiter = null;
        reject(e);
      };
    });
  }

  /** flags 与 TLS 状态不一致：断开连接并以终止性错误结束，不进入重连。 */
  private failFlags(): void {
    const fail = this.handshakeFail;
    this.handshakeWaiter = null;
    this.handshakeFail = null;
    this.close();
    this.opts.onFatal?.('TLS_FLAGS_MISMATCH');
    if (fail) fail(terminal('TLS_FLAGS_MISMATCH'));
  }

  private onFrame(frame: Frame): void {
    switch (frame.type) {
      case T.RES: {
        const body = jsonBody(frame);
        const pending = this.pending.get(body.id);
        if (pending) {
          this.pending.delete(body.id);
          clearTimeout(pending.timer);
          pending.resolve({ ok: !!body.ok, b: body.b, m: body.m ?? undefined });
        }
        return;
      }
      case T.SUB_OK: {
        const body = jsonBody(frame);
        const pending = this.pending.get(body.id);
        if (pending) {
          this.pending.delete(body.id);
          clearTimeout(pending.timer);
          pending.resolve({ ok: true, b: body });
        }
        return;
      }
      case T.PUSH: {
        const body = jsonBody(frame);
        for (const stream of this.streams) {
          if (stream.streamId === body.s) stream.emit(body.f);
        }
        return;
      }
      case T.PONG:
        return;
      case T.ERR: {
        // 致命错误帧：清空待答并断开（重连循环接管）
        for (const [, p] of this.pending) {
          clearTimeout(p.timer);
          p.reject(terminal(jsonBody(frame).m ?? 'ERR'));
        }
        this.pending.clear();
        this.transport.close();
        return;
      }
      default:
        return;
    }
  }
}

function terminal(code: string): Error & { terminal: boolean } {
  const e = new Error(code) as Error & { terminal: boolean };
  e.terminal = true;
  return e;
}

function jsonBody(frame: Frame): any {
  try {
    return JSON.parse(frame.payload.toString('utf8'));
  } catch {
    return {};
  }
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
