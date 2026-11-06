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
        this.activeStreams = []; // { id, write }，按连接登记；断开时清理
        this.sockets = new Set(); // 现役连接句柄（kickAll 用）
    }
    /** 踢掉全部现役连接（模拟服务端断线）。 */
    kickAll() {
        for (const s of this.sockets) {
            s.destroy();
        }
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
        this.sockets.add(socket);
        socket.on('close', () => {
            this.sockets.delete(socket);
            // 清理本连接登记的流（按 write 闭包归属：连接关闭后 write 不再可用）
            this.activeStreams = this.activeStreams.filter((st) => st.socket === socket);
        });
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
                // len 已含 type+flags：raw = [4, 4+len)，残留从 4+len 起（同 chunk 多帧不丢）
                const raw = buffer.subarray(4, 4 + len);
                buffer = buffer.subarray(4 + len);
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
                    // SUB（team/chat 流；1.0 mock 面向契约 1.2.0+1.4.0 的 App 平面订阅）
                    streamId += 1;
                    const sid = b64u(node_crypto_1.default.randomBytes(8));
                    this.lastSubSid = sid;
                    write(jsonFrame(0x21, { id: body.id, s: streamId, sid }));
                    this.activeStreams.push({ id: streamId, op: body.op, uuid: (body.p ?? {}).uuid, write, socket });
                    continue;
                }
                if (type === 0x23) {
                    // UNSUB：按流 ID 移除登记，后续推送不再送达
                    const sidNum = body.s;
                    this.activeStreams = this.activeStreams.filter((st) => st.id !== sidNum);
                    continue;
                }
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
                    // chat.*.send 成功后把消息回显进相关 chat 流（契约 1.4.0 定向投递）：
                    // public → 发送者；private → 发送者与对端各一份
                    if (b && b.ts && body.op.endsWith('.send')) {
                        const sender = (body.p ?? {}).uuid ?? '';
                        const peer = (body.p ?? {}).to ?? '';
                        const msg = {
                            t: 'd',
                            boot: 1,
                            seq: Date.now(),
                            ts: b.ts,
                            uuid: sender,
                            events: [{
                                    k: 'msg',
                                    mid: b.mid ?? Date.now(),
                                    from: sender,
                                    to: peer,
                                    scope: body.op.includes('private') ? 'private' : 'public',
                                    text: (body.p ?? {}).text ?? '',
                                }],
                        };
                        const targets = this.activeStreams.filter((st) => st.op === 'chat'
                            && (body.op.includes('private') ? st.uuid === sender || st.uuid === peer : st.uuid === sender));
                        for (const st of targets) {
                            st.write(jsonFrame(0x22, { s: st.id, f: msg }));
                        }
                    }
                    continue;
                }
            }
        });
    }
    /** 向最新登记的订阅推送一条 team 增量事件。 */
    pushLastTeamEvent(event) {
        const stream = this.activeStreams[this.activeStreams.length - 1];
        if (!stream)
            throw new Error('mock：当前无活跃订阅');
        this.pushTeamEvent(stream.id, stream.write, event);
    }
    /** 向指定 uuid 的 chat 流订阅定向推送（契约 1.4.0：按 uuid 定向投递）。 */
    pushChatEvent(uuid, event) {
        const targets = this.activeStreams.filter((st) => st.op === 'chat' && st.uuid === uuid);
        if (!targets.length)
            throw new Error(`mock：uuid=${uuid} 无活跃 chat 订阅`);
        for (const st of targets) {
            st.write(jsonFrame(0x22, {
                s: st.id,
                f: { t: 'd', boot: 1, seq: Date.now(), ts: Math.floor(Date.now() / 1000), uuid, events: [event] },
            }));
        }
    }
    /** 当前登记的 chat 流订阅数（按 uuid 过滤，-1 表示不过滤）。 */
    chatStreamCount(uuid) {
        return this.activeStreams.filter((st) => st.op === 'chat' && (uuid == null || st.uuid === uuid)).length;
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
