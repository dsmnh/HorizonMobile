"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preauthOp = preauthOp;
/**
 * 预鉴权操作（契约 §4.1 白名单：account.register/login/resetPassword、node.register）：
 * 在建立会话（AUTH）之前直发 REQ，用于换取会话 token。
 * 传输无关：测试注入 NodeTransport，RN 运行时注入 RnTransport。
 */
const protocol_1 = require("./protocol");
/** 单次预鉴权 op：建连 → HELLO → REQ → 拿 RES 即断。 */
async function preauthOp(transport, host, port, op, p, timeoutMs = 15000) {
    let buffer = Buffer.alloc(0);
    let gotNonce = false;
    await transport.connect(host, port);
    const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`预鉴权超时：${op}`)), timeoutMs);
        const finish = (r) => {
            clearTimeout(timer);
            transport.close();
            resolve(r);
        };
        transport.onData((chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            for (;;) {
                if (buffer.length < 4)
                    return;
                const len = buffer.readUInt32BE(0);
                if (buffer.length < 4 + len)
                    return;
                // len 已含 type+flags：raw = [4, 4+len)，残留自 4+len 起
                const raw = buffer.subarray(4, 4 + len);
                buffer = buffer.subarray(4 + len);
                const type = raw[0];
                const body = raw.length > 2 ? safeJson(raw.subarray(2)) : {};
                if (type === protocol_1.T.HELLO_ACK) {
                    gotNonce = true;
                    transport.write((0, protocol_1.jsonFrame)(protocol_1.T.REQ, { id: 1, op, p }));
                }
                else if (type === protocol_1.T.RES && gotNonce) {
                    finish({ ok: !!body.ok, b: body.b, m: body.m ?? undefined });
                    return;
                }
                else if (type === protocol_1.T.ERR) {
                    finish({ ok: false, b: null, m: body.m ?? 'ERR' });
                    return;
                }
            }
        });
        transport.write((0, protocol_1.jsonFrame)(protocol_1.T.HELLO, { v: 1, app: 'HorizonMobile/0.1.0', plane: 'app' }));
    });
    return result;
}
function safeJson(payload) {
    try {
        return JSON.parse(payload.toString('utf8'));
    }
    catch {
        return {};
    }
}
