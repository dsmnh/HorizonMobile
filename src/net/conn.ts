/**
 * App 平面多路复用连接（契约 1.2.0）：HELLO → AUTH（会话 token，HMAC）→ ACTIVE。
 * 一条 TCP 连接多路复用 REQ/SUB；断线指数退避重连（1s→15s），重连后带 sid 重新订阅。
 * 传输经 Transport 注入：测试/mock 用 node:net，RN 运行时注入 react-native-tcp-socket 适配器。
 */
import { Frame, PROTOCOL_VERSION, T, encodeFrame, jsonFrame } from './protocol';
import { CLOCK_SKEW_SEC, kidOf, sign } from './auth';

export interface Transport {
  connect(host: string, port: number): Promise<void>;
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
  private state: 'idle' | 'connecting' | 'auth' | 'active' = 'idle';
  private failCount = 0;

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

  /** 启动连接与常驻重连循环；resolve 于首次鉴权成功，reject 于终止性错误（撤销/版本不兼容）。 */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.transport.onData((chunk) => this.onData(chunk));
    this.transport.onClose(() => this.onDisconnected(false));
    await this.connectLoopFirst();
  }

  private async connectLoopFirst(): Promise<void> {
    // 首次连接：失败按退避重试（终止性错误向上抛）
    let backoff = this.opts.backoffInitialMs!;
    while (true) {
      try {
        await this.handshakeAndAuth();
        this.authed = true;
        await this.resubscribeAll();
        return;
      } catch (e: any) {
        if (e.terminal) {
          this.running = false;
          throw e;
        }
        await sleep(backoff);
        backoff = Math.min(backoff * 2, this.opts.backoffMaxMs!);
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.running) return;
    this.authed = false;
    let backoff = this.opts.backoffInitialMs!;
    const attempt = async (): Promise<void> => {
      while (this.running) {
        try {
          await this.handshakeAndAuth();
          this.authed = true;
          await this.resubscribeAll();
          return;
        } catch (e: any) {
          if (e.terminal) {
            this.running = false;
            this.authed = false;
            return;
          }
          await sleep(backoff);
          backoff = Math.min(backoff * 2, this.opts.backoffMaxMs!);
        }
      }
    };
    void attempt();
  }

  private async handshakeAndAuth(): Promise<void> {
    this.state = 'connecting';
    await this.transport.connect(this.opts.host, this.opts.port);
    this.state = 'auth';

    // HELLO
    this.nonce = '';
    const ack = await this.expectFrame(
      jsonFrame(T.HELLO, {
        v: PROTOCOL_VERSION,
        app: this.opts.app,
        plane: 'app',
      }),
      [T.HELLO_ACK, T.ERR],
    );
    if (ack.frame.type === T.ERR) {
      throw terminal(jsonBody(ack.frame).m ?? 'ERR');
    }
    const body = jsonBody(ack.frame);
    if (body.v !== PROTOCOL_VERSION) {
      throw terminal(`VERSION_MISMATCH:server=${body.v}`);
    }
    this.nonce = body.nonce;
    this.clockOffset = body.time - nowSec();

    // AUTH（token 不上网线；CLOCK 自动重签一次）
    await this.authOnce();

    // 握手结束：恢复主数据泵（expectFrame 期间临时接管过）
    this.transport.onData((chunk) => this.onData(chunk));
    // PING 保活
    const ping = setInterval(() => {
      try {
        this.transport.write(encodeFrame(T.PING));
      } catch {
        clearInterval(ping);
      }
    }, 20_000);
  }

  private async authOnce(): Promise<void> {
    const ts = nowSec() + this.clockOffset;
    const sig = sign(this.opts.token, ts, this.nonce);
    const reply = await this.expectFrame(
      jsonFrame(T.AUTH, { kid: kidOf(this.opts.token), ts, sig }),
      [T.AUTH_OK, T.AUTH_FAIL],
    );
    if (reply.frame.type === T.AUTH_FAIL) {
      const body = jsonBody(reply.frame);
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
          }),
          [T.AUTH_OK, T.AUTH_FAIL],
        );
        if (retry.frame.type === T.AUTH_FAIL) {
          throw terminal(jsonBody(retry.frame).code ?? 'AUTH_FAILED');
        }
        this.restorePump();
        return;
      }
      throw terminal(code);
    }
    this.restorePump();
  }

  /** expectFrame 临时接管过 onData；每次握手帧读取后恢复主泵。 */
  private restorePump(): void {
    this.transport.onData((chunk) => this.onData(chunk));
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
    this.transport.write(jsonFrame(T.REQ, { id, op, p }));
    return promise;
  }

  /** 订阅 team 流（1.0 的 App 平面仅登记该流）。 */
  subscribeTeam(uuid: string): Stream {
    const stream = new Stream('team');
    stream.connRef = this;
    this.streams.push(stream);
    if (this.authed) {
      this.rawSub(stream, { uuid }).catch(() => {
        // 订阅失败留待重连时补订
      });
    }
    return stream;
  }

  private async rawSub(stream: Stream, p: any, sid?: string): Promise<void> {
    stream.lastParams = p;
    const id = ++this.nextId;
    const frame: any = { id, op: stream.op, p };
    if (sid) frame.sid = sid;
    this.transport.write(jsonFrame(T.SUB, frame));
    // SUB_OK 由帧分发器按 id 完成；这里仅登记映射。
    // 断连时 pending 被 reject——订阅重订由重连循环接管，此处吞掉拒绝避免未捕获崩溃。
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
    if (streamId < 0) return;
    const frame: any = { s: streamId };
    this.transport.write(jsonFrame(T.UNSUB, frame));
  }

  close(): void {
    this.running = false;
    this.authed = false;
    this.transport.close();
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('连接已关闭'));
    }
    this.pending.clear();
  }

  // ---------- 帧分发 ----------

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.buffer.length < 4) return;
      const len = this.buffer.readUInt32BE(0);
      if (len < 2 || len > 16 * 1024 * 1024) {
        this.transport.close();
        return;
      }
      if (this.buffer.length < 4 + len) return;
      const raw = this.buffer.subarray(4, 4 + 2 + len);
      this.buffer = this.buffer.subarray(4 + 2 + len);
      const frame: Frame = { type: raw[0], flags: raw[1], payload: raw.subarray(2) };
      this.onFrame(frame);
    }
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
        const f = jsonBody(frame).f;
        const s = jsonBody(frame).s;
        for (const stream of this.streams) {
          if (stream.streamId === s) stream.emit(f);
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

  /** 读一帧的简易路径：仅握手期使用（之后进入连续缓冲分发）。 */
  private expectFrame(writeFrame: Buffer, _accept: number[]): Promise<{ frame: Frame }> {
    this.transport.write(writeFrame);
    // 握手期帧序：直接从缓冲读；为保持实现简单，握手期不并发其他帧
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('握手超时')), 15_000);
      const tryParse = (): void => {
        void 0;
        if (this.buffer.length < 4) return;
        const len = this.buffer.readUInt32BE(0);
        if (this.buffer.length < 4 + len) return;
        const raw = this.buffer.subarray(4, 4 + 2 + len);
        this.buffer = this.buffer.subarray(4 + 2 + len);
        clearTimeout(timer);
        resolve({ frame: { type: raw[0], flags: raw[1], payload: raw.subarray(2) } });
      };
      const prev = this.onData;
      // 握手期接管数据泵（此时无并发帧）
      this.transport.onData((chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        tryParse();
      });
      void prev;
      tryParse();
    });
  }

  private async resubscribeAll(): Promise<void> {
    for (const stream of this.streams) {
      try {
        await this.rawSub(stream, stream.lastParams ?? {}, stream.sid || undefined);
      } catch {
        // 单个流重订失败不阻断整体重连；该流由后续重连继续补订
      }
    }
  }

  private onDisconnected(_grace: boolean): void {
    if (!this.running) return;
    this.authed = false;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('连接断开'));
    }
    this.pending.clear();
    this.scheduleReconnect();
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
