"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HorizonConn = exports.Stream = void 0;
/**
 * App 平面多路复用连接（契约 1.2.0）：HELLO → AUTH（会话 token，HMAC）→ ACTIVE。
 * 一条 TCP 连接多路复用 REQ/SUB；断线指数退避重连（1s→15s），重连后带 sid 重新订阅。
 * 传输经 Transport 注入：测试/mock 用 node:net，RN 运行时注入 react-native-tcp-socket 适配器。
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
        this.state = 'idle';
        this.failCount = 0;
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
        this.transport.onData((chunk) => this.onData(chunk));
        this.transport.onClose(() => this.onDisconnected(false));
        await this.connectLoopFirst();
    }
    async connectLoopFirst() {
        // 首次连接：失败按退避重试（终止性错误向上抛）
        let backoff = this.opts.backoffInitialMs;
        while (true) {
            try {
                await this.handshakeAndAuth();
                this.authed = true;
                await this.resubscribeAll();
                return;
            }
            catch (e) {
                if (e.terminal) {
                    this.running = false;
                    throw e;
                }
                await sleep(backoff);
                backoff = Math.min(backoff * 2, this.opts.backoffMaxMs);
            }
        }
    }
    scheduleReconnect() {
        if (!this.running)
            return;
        this.authed = false;
        let backoff = this.opts.backoffInitialMs;
        const attempt = async () => {
            while (this.running) {
                try {
                    await this.handshakeAndAuth();
                    this.authed = true;
                    await this.resubscribeAll();
                    return;
                }
                catch (e) {
                    if (e.terminal) {
                        this.running = false;
                        this.authed = false;
                        return;
                    }
                    await sleep(backoff);
                    backoff = Math.min(backoff * 2, this.opts.backoffMaxMs);
                }
            }
        };
        void attempt();
    }
    async handshakeAndAuth() {
        this.state = 'connecting';
        await this.transport.connect(this.opts.host, this.opts.port);
        this.state = 'auth';
        // HELLO
        this.nonce = '';
        const ack = await this.expectFrame((0, protocol_1.jsonFrame)(protocol_1.T.HELLO, {
            v: protocol_1.PROTOCOL_VERSION,
            app: this.opts.app,
            plane: 'app',
        }), [protocol_1.T.HELLO_ACK, protocol_1.T.ERR]);
        if (ack.frame.type === protocol_1.T.ERR) {
            throw terminal(jsonBody(ack.frame).m ?? 'ERR');
        }
        const body = jsonBody(ack.frame);
        if (body.v !== protocol_1.PROTOCOL_VERSION) {
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
                this.transport.write((0, protocol_1.encodeFrame)(protocol_1.T.PING));
            }
            catch {
                clearInterval(ping);
            }
        }, 20000);
    }
    async authOnce() {
        const ts = nowSec() + this.clockOffset;
        const sig = (0, auth_1.sign)(this.opts.token, ts, this.nonce);
        const reply = await this.expectFrame((0, protocol_1.jsonFrame)(protocol_1.T.AUTH, { kid: (0, auth_1.kidOf)(this.opts.token), ts, sig }), [protocol_1.T.AUTH_OK, protocol_1.T.AUTH_FAIL]);
        if (reply.frame.type === protocol_1.T.AUTH_FAIL) {
            const body = jsonBody(reply.frame);
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
                }), [protocol_1.T.AUTH_OK, protocol_1.T.AUTH_FAIL]);
                if (retry.frame.type === protocol_1.T.AUTH_FAIL) {
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
    restorePump() {
        this.transport.onData((chunk) => this.onData(chunk));
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
    /** 订阅 team 流（1.0 的 App 平面仅登记该流）。 */
    subscribeTeam(uuid) {
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
    async rawSub(stream, p, sid) {
        stream.lastParams = p;
        const id = ++this.nextId;
        const frame = { id, op: stream.op, p };
        if (sid)
            frame.sid = sid;
        this.transport.write((0, protocol_1.jsonFrame)(protocol_1.T.SUB, frame));
        // SUB_OK 由帧分发器按 id 完成；这里仅登记映射。
        // 断连时 pending 被 reject——订阅重订由重连循环接管，此处吞掉拒绝避免未捕获崩溃。
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
        if (streamId < 0)
            return;
        const frame = { s: streamId };
        this.transport.write((0, protocol_1.jsonFrame)(protocol_1.T.UNSUB, frame));
    }
    close() {
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
    onData(chunk) {
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
            const raw = this.buffer.subarray(4, 4 + 2 + len);
            this.buffer = this.buffer.subarray(4 + 2 + len);
            const frame = { type: raw[0], flags: raw[1], payload: raw.subarray(2) };
            this.onFrame(frame);
        }
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
                const f = jsonBody(frame).f;
                const s = jsonBody(frame).s;
                for (const stream of this.streams) {
                    if (stream.streamId === s)
                        stream.emit(f);
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
    /** 读一帧的简易路径：仅握手期使用（之后进入连续缓冲分发）。 */
    expectFrame(writeFrame, _accept) {
        this.transport.write(writeFrame);
        // 握手期帧序：直接从缓冲读；为保持实现简单，握手期不并发其他帧
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('握手超时')), 15000);
            const tryParse = () => {
                void 0;
                if (this.buffer.length < 4)
                    return;
                const len = this.buffer.readUInt32BE(0);
                if (this.buffer.length < 4 + len)
                    return;
                const raw = this.buffer.subarray(4, 4 + 2 + len);
                this.buffer = this.buffer.subarray(4 + 2 + len);
                clearTimeout(timer);
                resolve({ frame: { type: raw[0], flags: raw[1], payload: raw.subarray(2) } });
            };
            const prev = this.onData;
            // 握手期接管数据泵（此时无并发帧）
            this.transport.onData((chunk) => {
                this.buffer = Buffer.concat([this.buffer, chunk]);
                tryParse();
            });
            void prev;
            tryParse();
        });
    }
    async resubscribeAll() {
        for (const stream of this.streams) {
            try {
                await this.rawSub(stream, stream.lastParams ?? {}, stream.sid || undefined);
            }
            catch {
                // 单个流重订失败不阻断整体重连；该流由后续重连继续补订
            }
        }
    }
    onDisconnected(_grace) {
        if (!this.running)
            return;
        this.authed = false;
        for (const [, p] of this.pending) {
            clearTimeout(p.timer);
            p.reject(new Error('连接断开'));
        }
        this.pending.clear();
        this.scheduleReconnect();
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
