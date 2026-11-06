"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HorizonConn = exports.Stream = void 0;
/**
 * App 平面多路复用连接（契约 1.2.0）：HELLO → AUTH（会话 token，HMAC）→ ACTIVE。
 * 一条 TCP 连接多路复用 REQ/SUB；断线指数退避重连（1s→15s），重连后带 sid 重新订阅。
 * 传输经 Transport 注入：测试/mock 用 node:net，RN 运行时注入 react-native-tcp-socket 适配器。
 *
 * 并发纪律（e2e 重连风暴教训）：
 * - 数据泵全局唯一：start() 注册一次，永不替换；握手读帧走同一泵的一次性 waiter。
 * - 重连单飞：reconnecting 标志合并多次断连事件，任何时刻至多一个重连循环。
 * - PING 定时器随连接生灭：断连/关闭先 clear，杜绝旧定时器向新连接写帧。
 */
const protocol_1 = require("./protocol");
const auth_1 = require("./auth");
/** 订阅流：EventSource 形状（addEventListener / close），屏幕层与 SSE 写法一致。 */
class Stream {
    constructor(op) {
        this.handlers = [];
        this.fullHandlers = [];
        this.streamId = -1;
        this.sid = '';
        this.lastParams = {};
        this.op = op;
    }
    addEventListener(cb) {
        this.handlers.push(cb);
    }
    onFull(cb) {
        this.fullHandlers.push(cb);
    }
    close() {
        if (this.connRef)
            this.connRef.unsub(this.streamId);
        this.handlers = [];
        this.fullHandlers = [];
    }
    /** @internal */
    emit(f) {
        if (f.t === 'f') {
            for (const cb of this.fullHandlers)
                cb(f);
            return;
        }
        if (f.t === 'd') {
            for (const e of f.events ?? []) {
                for (const cb of this.handlers)
                    cb(e);
            }
        }
    }
}
exports.Stream = Stream;
class HorizonConn {
    constructor(transport, opts) {
        this.buffer = Buffer.alloc(0);
        this.pending = new Map();
        this.streams = [];
        this.nextId = 0;
        this.running = false;
        this.authed = false;
        this.nonce = '';
        this.clockOffset = 0;
        this.failCount = 0;
        /** 握手期一次性读帧 waiter；ACTIVE 期为 null，帧全部走 onFrame 分发。 */
        this.handshakeWaiter = null;
        /** 重连单飞标志：onDisconnected 可能被多次触发，只放行第一个。 */
        this.reconnecting = false;
        /** 当前连接的 PING 定时器；断连即清。 */
        this.pingTimer = null;
        this.pumpInstalled = false;
        this.transport = transport;
        this.opts = {
            app: 'HorizonMobile/0.1.0',
            requestTimeoutMs: 20000,
            backoffInitialMs: 1000,
            backoffMaxMs: 15000,
            ...opts,
        };
    }
    get isConnected() {
        return this.authed;
    }
    /** 启动连接与常驻重连循环；resolve 于首次鉴权成功，reject 于终止性错误（撤销/版本不兼容）。 */
    async start() {
        if (this.running)
            return;
        this.running = true;
        if (!this.pumpInstalled) {
            this.transport.onData((chunk) => this.pump(chunk));
            this.transport.onClose(() => this.onDisconnected());
            this.pumpInstalled = true;
        }
        let backoff = this.opts.backoffInitialMs;
        while (this.running) {
            try {
                await this.handshakeAndAuth();
                this.authed = true;
                this.failCount = 0;
                await this.resubscribeAll();
                return;
            }
            catch (e) {
                if (e.terminal || !this.running)
                    throw e;
                await sleep(backoff);
                backoff = Math.min(backoff * 2, this.opts.backoffMaxMs);
            }
        }
    }
    /** 发送请求；断线期间 reject。 */
    async req(op, p = {}) {
        if (!this.authed)
            throw new Error('未连接');
        const id = ++this.nextId;
        const promise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`请求超时：${op}`));
            }, this.opts.requestTimeoutMs);
            this.pending.set(id, { resolve, reject, timer });
        });
        this.transport.write((0, protocol_1.jsonFrame)(protocol_1.T.REQ, { id, op, p }));
        return promise;
    }
    /** 订阅任意流（通用入口）；返回 Stream，streamId 由 SUB_OK 异步回填。 */
    subscribeStream(op, p = {}) {
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
    subscribeTeam(uuid) {
        return this.subscribeStream('team', { uuid });
    }
    async rawSub(stream, p, sid) {
        if (!this.authed)
            return; // 断连中的补订请求直接放弃，重连循环会接管
        stream.lastParams = p;
        const id = ++this.nextId;
        const frame = { id, op: stream.op, p };
        if (sid)
            frame.sid = sid;
        this.transport.write((0, protocol_1.jsonFrame)(protocol_1.T.SUB, frame));
        // SUB_OK 由帧分发器按 id 完成；断连时 pending 被 reject，这里吞掉避免未捕获崩溃。
        const promise = new Promise((resolve) => {
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
    unsub(streamId) {
        if (streamId < 0 || !this.authed)
            return;
        const frame = { s: streamId };
        this.transport.write((0, protocol_1.jsonFrame)(protocol_1.T.UNSUB, frame));
    }
    close() {
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
    async handshakeAndAuth() {
        await this.transport.connect(this.opts.host, this.opts.port);
        // 握手期无并发帧（服务端只回应答），一次性 waiter 从公共泵取帧
        const ack = await this.expectFrame((0, protocol_1.jsonFrame)(protocol_1.T.HELLO, {
            v: protocol_1.PROTOCOL_VERSION,
            app: this.opts.app,
            plane: 'app',
        }));
        if (ack.type === protocol_1.T.ERR) {
            throw terminal(jsonBody(ack).m ?? 'ERR');
        }
        const body = jsonBody(ack);
        if (body.v !== protocol_1.PROTOCOL_VERSION) {
            throw terminal(`VERSION_MISMATCH:server=${body.v}`);
        }
        this.nonce = body.nonce;
        this.clockOffset = body.time - nowSec();
        await this.authOnce();
        this.startPing();
    }
    async authOnce() {
        const ts = nowSec() + this.clockOffset;
        const sig = (0, auth_1.sign)(this.opts.token, ts, this.nonce);
        const reply = await this.expectFrame((0, protocol_1.jsonFrame)(protocol_1.T.AUTH, { kid: (0, auth_1.kidOf)(this.opts.token), ts, sig }));
        if (reply.type === protocol_1.T.AUTH_FAIL) {
            const body = jsonBody(reply);
            const code = body.code ?? 'AUTH_FAILED';
            if (code === 'CLOCK') {
                const serverTime = body.time ?? 0;
                if (serverTime > 0)
                    this.clockOffset = serverTime - nowSec();
                // 按 §4.2 重签一次
                const ts2 = nowSec() + this.clockOffset;
                const retry = await this.expectFrame((0, protocol_1.jsonFrame)(protocol_1.T.AUTH, {
                    kid: (0, auth_1.kidOf)(this.opts.token),
                    ts: ts2,
                    sig: (0, auth_1.sign)(this.opts.token, ts2, this.nonce),
                }));
                if (retry.type === protocol_1.T.AUTH_FAIL) {
                    throw terminal(jsonBody(retry).code ?? 'AUTH_FAILED');
                }
                return;
            }
            throw terminal(code);
        }
    }
    startPing() {
        this.stopPing();
        this.pingTimer = setInterval(() => {
            if (!this.authed) {
                this.stopPing();
                return;
            }
            try {
                this.transport.write((0, protocol_1.encodeFrame)(protocol_1.T.PING));
            }
            catch {
                this.stopPing();
            }
        }, 20000);
    }
    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
    async resubscribeAll() {
        for (const stream of this.streams) {
            if (!this.authed)
                return; // 重订途中断线：交给重连循环
            try {
                await this.rawSub(stream, stream.lastParams ?? {}, stream.sid || undefined);
            }
            catch {
                // 单个流重订失败不阻断整体重连；该流由后续重连继续补订
            }
        }
    }
    /** 断连统一入口（传输 close 触发）；pending 清算 + 单飞重连。 */
    onDisconnected() {
        const wasAuthed = this.authed;
        this.authed = false;
        this.stopPing();
        for (const [, p] of this.pending) {
            clearTimeout(p.timer);
            p.reject(new Error('连接断开'));
        }
        this.pending.clear();
        if (!this.running || this.reconnecting)
            return;
        if (!wasAuthed)
            return; // 首连循环尚未结束，由 start 的循环负责重试
        this.reconnecting = true;
        void this.reconnectLoop();
    }
    async reconnectLoop() {
        let backoff = this.opts.backoffInitialMs;
        while (this.running && !this.authed) {
            try {
                await this.handshakeAndAuth();
                this.authed = true;
                this.reconnecting = false;
                await this.resubscribeAll();
                return;
            }
            catch (e) {
                if (e.terminal || !this.running) {
                    this.reconnecting = false;
                    return;
                }
                await sleep(backoff);
                backoff = Math.min(backoff * 2, this.opts.backoffMaxMs);
            }
        }
        this.reconnecting = false;
    }
    // ---------- 帧泵与分发 ----------
    /** 全局唯一数据泵：握手帧交给 waiter，其余帧走分发。 */
    pump(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        for (;;) {
            if (this.buffer.length < 4)
                return;
            const len = this.buffer.readUInt32BE(0);
            if (len < 2 || len > 16 * 1024 * 1024) {
                this.transport.close();
                return;
            }
            if (this.buffer.length < 4 + len)
                return;
            // len 已含 type+flags 两字节：raw = [4, 4+len)，残留从 4+len 起——多切 2 字节会吞掉同 chunk 下一帧
            const raw = this.buffer.subarray(4, 4 + len);
            this.buffer = this.buffer.subarray(4 + len);
            const frame = { type: raw[0], flags: raw[1], payload: raw.subarray(2) };
            if (this.handshakeWaiter) {
                const deliver = this.handshakeWaiter;
                this.handshakeWaiter = null;
                deliver(frame);
            }
            else {
                this.onFrame(frame);
            }
        }
    }
    /** 读一帧的握手专用路径：写帧后挂一次性 waiter，由公共泵投递。 */
    expectFrame(writeFrame) {
        this.transport.write(writeFrame);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.handshakeWaiter = null;
                reject(new Error('握手超时'));
            }, 15000);
            this.handshakeWaiter = (f) => {
                clearTimeout(timer);
                resolve(f);
            };
        });
    }
    onFrame(frame) {
        switch (frame.type) {
            case protocol_1.T.RES: {
                const body = jsonBody(frame);
                const pending = this.pending.get(body.id);
                if (pending) {
                    this.pending.delete(body.id);
                    clearTimeout(pending.timer);
                    pending.resolve({ ok: !!body.ok, b: body.b, m: body.m ?? undefined });
                }
                return;
            }
            case protocol_1.T.SUB_OK: {
                const body = jsonBody(frame);
                const pending = this.pending.get(body.id);
                if (pending) {
                    this.pending.delete(body.id);
                    clearTimeout(pending.timer);
                    pending.resolve({ ok: true, b: body });
                }
                return;
            }
            case protocol_1.T.PUSH: {
                const body = jsonBody(frame);
                for (const stream of this.streams) {
                    if (stream.streamId === body.s)
                        stream.emit(body.f);
                }
                return;
            }
            case protocol_1.T.PONG:
                return;
            case protocol_1.T.ERR: {
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
exports.HorizonConn = HorizonConn;
function terminal(code) {
    const e = new Error(code);
    e.terminal = true;
    return e;
}
function jsonBody(frame) {
    try {
        return JSON.parse(frame.payload.toString('utf8'));
    }
    catch {
        return {};
    }
}
function nowSec() {
    return Math.floor(Date.now() / 1000);
}
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
