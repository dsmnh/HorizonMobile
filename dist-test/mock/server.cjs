"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAppBackend = void 0;
/**
 * App 平面 mock 后端（契约 1.2.0）：HELLO/AUTH（HMAC 验签，可注入 CLOCK/失败）、
 * REQ 分发（脚本化 handlers）、team 订阅流 PUSH、断开控制。供 e2e 对拍使用。
 */
const node_net_1 = __importDefault(require("node:net"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const b64u = (buf) => Buffer.from(buf).toString('base64url');
class MockAppBackend {
    constructor() {
        this.token = 'tok-12345678-abcdefgh-ijkl';
        this.handlers = new Map(); // op -> (p) => b
        this.clockFails = 0;
        this.rejectAuth = false;
        this.dropAfterAuth = false;
        this.subscribed = 0;
        this.lastSubSid = null;
        this.authCount = 0;
        this.server = null;
        this.pushEvent = null; // (streamId, write) => void
    }
    listen() {
        return new Promise((resolve) => {
            this.server = node_net_1.default.createServer((socket) => this.handle(socket));
            this.server.listen(0, '127.0.0.1', () => resolve(this.server.address().port));
        });
    }
    close() {
        if (this.server)
            this.server.close();
    }
    handle(socket) {
        let buffer = Buffer.alloc(0);
        let nonce = null;
        let authed = false;
        let streamId = 0;
        this.subscribed += 0;
        const write = (frame) => {
            if (!socket.destroyed && socket.writable)
                socket.write(frame);
        };
        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            for (;;) {
                if (buffer.length < 4)
                    return;
                const len = buffer.readUInt32BE(0);
                if (buffer.length < 4 + len)
                    return;
                const raw = buffer.subarray(4, 4 + 2 + len);
                buffer = buffer.subarray(4 + 2 + len);
                const type = raw[0];
                const payload = raw.subarray(2);
                let body = {};
                try {
                    body = payload.length ? JSON.parse(payload.toString('utf8')) : {};
                }
                catch (e) {
                    return; // 截断/损坏帧（连接关闭时的残留），丢弃
                }
                if (type === 0x01) {
                    // HELLO
                    if (body.v !== 1 || body.plane !== 'app') {
                        write(jsonFrame(0x40, { m: body.plane === 'node' ? 'BAD_PLANE' : 'VERSION_MISMATCH:server=1' }));
                        socket.end();
                        return;
                    }
                    nonce = b64u(node_crypto_1.default.randomBytes(8));
                    write(jsonFrame(0x02, {
                        v: 1, name: 'Mock', ver: '0.0.0',
                        time: Math.floor(Date.now() / 1000),
                        nonce, caps: ['account', 'admin', 'team'], plane: 'app',
                    }));
                    continue;
                }
                if (type === 0x03) {
                    // AUTH
                    this.authCount += 1;
                    console.log("[mock] AUTH收到 rejectAuth=", this.rejectAuth, "kid=", body.kid, "ts=", body.ts);
                    this.authCount += 1;
                    console.log("[mock] body=" + JSON.stringify(body) + " now=" + Math.floor(Date.now() / 1000));
                    const now = Math.floor(Date.now() / 1000);
                    if (Math.abs(now - body.ts) > 600) {
                        write(jsonFrame(0x05, { code: 'CLOCK', time: now }));
                        continue;
                    }
                    if (this.clockFails > 0) {
                        this.clockFails -= 1;
                        write(jsonFrame(0x05, { code: 'CLOCK', time: now }));
                        continue;
                    }
                    if (this.rejectAuth) {
                        write(jsonFrame(0x05, { code: 'AUTH_FAILED', time: now }));
                        socket.end();
                        return;
                    }
                    const canonical = `HORIZON\n${body.ts}\n${nonce}`;
                    const expect = node_crypto_1.default.createHmac('sha256', this.token).update(canonical).digest('base64url');
                    if (body.sig !== expect) {
                        console.log("[mock] sig mismatch:", body.sig, "vs", expect, "nonce=", nonce, "ts=", body.ts);
                        write(jsonFrame(0x05, { code: 'AUTH_FAILED', time: now }));
                        socket.end();
                        return;
                    }
                    authed = true;
                    write(encodeFrame(0x04, Buffer.from(JSON.stringify({ role: 'user' }))));
                    if (this.dropAfterAuth) {
                        socket.end();
                        return;
                    }
                    continue;
                }
                if (type === 0x20) {
                    // SUB（team 流）
                    streamId += 1;
                    const sid = b64u(node_crypto_1.default.randomBytes(8));
                    this.lastSubSid = sid;
                    write(jsonFrame(0x21, { id: body.id, s: streamId, sid }));
                    if (this.pushEvent) {
                        this.pushEvent(streamId, write);
                    }
                    continue;
                }
                if (type === 0x23)
                    continue; // UNSUB
                if (type === 0x30) {
                    write(encodeFrame(0x31));
                    continue;
                }
                if (type === 0x10) {
                    const handler = this.handlers.get(body.op);
                    if (!handler) {
                        write(jsonFrame(0x11, { id: body.id, ok: false, m: 'UNKNOWN_OP' }));
                        continue;
                    }
                    const b = handler(body.p ?? {});
                    if (b === undefined)
                        continue; // 不回包（超时用例）
                    write(jsonFrame(0x11, { id: body.id, ok: true, b }));
                    continue;
                }
            }
        });
    }
    /** 向当前（唯一）订阅推送一条 team 增量事件。 */
    pushTeamEvent(streamId, write, event) {
        write(jsonFrame(0x22, {
            s: streamId,
            f: { t: 'd', boot: 1, seq: Date.now(), ts: Math.floor(Date.now() / 1000), uuid: event.uuid ?? '', events: [event] },
        }));
    }
}
exports.MockAppBackend = MockAppBackend;
function encodeFrame(type, payload) {
    const body = payload ?? Buffer.alloc(0);
    const out = Buffer.alloc(4 + 2 + body.length);
    out.writeUInt32BE(body.length + 2, 0);
    out[4] = type;
    out[5] = 0;
    body.copy(out, 6);
    return out;
}
function jsonFrame(type, obj) {
    return encodeFrame(type, Buffer.from(JSON.stringify(obj), 'utf8'));
}
