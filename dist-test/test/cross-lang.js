"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/** 跨语言互操作探针：TS 协议栈 ↔ 真后端 JAR。用法：node dist-test/test/cross-lang.js [端口] */
const node_net_1 = __importDefault(require("node:net"));
const conn_1 = require("../src/net/conn");
const transport_node_1 = require("./transport-node");
const HOST = '127.0.0.1';
const PORT = parseInt(process.argv[2] ?? '44544', 10);
function encodeFrame(type, obj) {
    const body = obj ? Buffer.from(JSON.stringify(obj), 'utf8') : Buffer.alloc(0);
    const out = Buffer.alloc(4 + 2 + body.length);
    out.writeUInt32BE(body.length + 2, 0);
    out[4] = type;
    out[5] = 0;
    body.copy(out, 6);
    return out;
}
/** 预鉴权 register：不经 HorizonConn（其 start 前提是已有 token），裸帧换 token。 */
function rawRegister(port) {
    return new Promise((resolve, reject) => {
        const socket = node_net_1.default.connect({ host: HOST, port });
        let buffer = Buffer.alloc(0);
        let gotNonce = false;
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error('rawRegister 超时'));
        }, 10000);
        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            for (;;) {
                if (buffer.length < 4)
                    return;
                const len = buffer.readUInt32BE(0);
                if (buffer.length < 4 + len)
                    return;
                const type = buffer[4];
                const payload = buffer.subarray(6, 4 + len);
                buffer = buffer.subarray(4 + len);
                const body = payload.length ? JSON.parse(payload.toString('utf8')) : {};
                if (type === 0x02) {
                    gotNonce = true;
                    socket.write(encodeFrame(0x10, {
                        id: 1,
                        op: 'account.register',
                        p: { name: `probe-${Date.now() % 1000000}`, pass: 'probe-password-123' },
                    }));
                }
                else if (type === 0x11 && gotNonce) {
                    clearTimeout(timer);
                    socket.destroy();
                    if (body.ok && body.b?.token) {
                        resolve(body.b.token);
                    }
                    else {
                        reject(new Error(`register 失败：${body.m ?? JSON.stringify(body)}`));
                    }
                    return;
                }
            }
        });
        socket.on('error', (e) => {
            clearTimeout(timer);
            reject(e);
        });
        socket.write(encodeFrame(0x01, { v: 1, app: 'CrossLangProbe/1.0', plane: 'app' }));
    });
}
async function main() {
    const results = [];
    const step = (name, pass, detail) => {
        const line = `${pass ? 'PASS' : 'FAIL'}  ${name}  ｜ ${detail}`;
        results.push(line);
        console.log(line);
    };
    console.log(`真后端 ${HOST}:${PORT} 跨语言探针`);
    const token = await rawRegister(PORT);
    step('预鉴权 register（裸帧 ↔ Java）', !!token, `token kid=${token.substring(0, 8)}`);
    const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: HOST, port: PORT, token });
    await conn.start();
    step('HELLO/AUTH（noble HMAC ↔ Java）', conn.isConnected, '会话已建立');
    const uuids = await conn.req('account.uuids');
    step('鉴权域 REQ 往返 account.uuids', uuids.ok, JSON.stringify(uuids.b ?? uuids.m));
    const create = await conn.req('team.create', { name: `探针队-${Date.now() % 100000}` });
    // 未绑定 UUID 时后端按契约拒绝（FORBIDDEN/NO_UUID），能收到结构化 RES 即证明错误路径贯通
    step('team.create 错误路径贯通', typeof create.ok === 'boolean', `ok=${create.ok} m=${create.m ?? '-'}`);
    conn.close();
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(failed === 0 ? '== 跨语言探针全部通过 ==' : `== 跨语言探针失败 ${failed} 项 ==`);
    process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => {
    console.error('探针异常：', e.message);
    process.exit(2);
});
