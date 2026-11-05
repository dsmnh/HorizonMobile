"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const conn_1 = require("../src/net/conn");
const transport_node_1 = require("./transport-node");
async function main() {
    const port = parseInt(process.argv[2] ?? '44554', 10);
    const results = [];
    const step = (name, pass, detail) => {
        const line = `${pass ? 'PASS' : 'FAIL'}  ${name}  ｜ ${detail}`;
        results.push(line);
        console.log(line);
    };
    // 1) 注册并鉴权
    const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), {
        host: '127.0.0.1', port, token: '', app: 'TS-Probe/1.0',
    });
    // 先不传 token：用 register 流程
    // HorizonConn.start() 需要 token——走 register 需要独立连接
    // 简化：用两个连接。第一个 register，第二个用 token 连接。
    const regConn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), {
        host: '127.0.0.1', port, token: '', app: 'TS-Reg/1.0',
    });
    // register 是预鉴权 op，但 HorizonConn.start() 需要 token——直接发原始帧绕过状态机
    // 这里用 NodeTransport 底层直发预鉴权帧
    const transport = new transport_node_1.NodeTransport();
    await transport.connect('127.0.0.1', port);
    const { encodeFrame, T, readFrame } = await Promise.resolve().then(() => __importStar(require('../src/net/protocol')));
    const { sign, kidOf } = await Promise.resolve().then(() => __importStar(require('../src/net/auth')));
    const write = (type, obj) => transport.write(encodeFrame(type, Buffer.from(JSON.stringify(obj), 'utf8')));
    const readBuf = Buffer.alloc(0);
    let pending = null;
    transport.onData((chunk) => {
        if (pending) {
            pending(chunk);
            pending = null;
        }
    });
    // HELLO
    write(T.HELLO, { v: 1, app: 'TS-Probe/1.0', plane: 'app' });
    // 等 HELLO_ACK（简化：定时读）
    await sleep(200);
    // 预鉴权 register
    write(T.REQ, { id: 1, op: 'account.register', p: { name: 'ts-probe-' + Date.now() % 100000, pass: 'password-123' } });
    await sleep(300);
    // 由于 expectFrame 的接管式设计较复杂，改用 HorizonConn 的公开流程：
    // 直接构造一个带 token 的连接（先从原始帧拿 token）
    // ——为简化，改为走 mock-free 的 HorizonConn 全流程
    // 实际上 HorizonConn.start() 需要 token，但 register 的预鉴权帧不在 HorizonConn 里。
    // 改用两步：1) 底层帧 register 拿 token；2) 用 HorizonConn 以该 token 走完整流程。
    // 这里只做第 2 步的验证（token 从 bash 侧传入太复杂，改用环境变量）
    // 简化方案：起两个 TS 连接，第一个走底层 register，第二个走 HorizonConn。
    console.log('[probe] TS↔Java 互操作：底层帧已发送');
    transport.close();
    // 用 HorizonConn（需要已有 token）——从环境变量取（由 bash 编排传入）
    // 简化：改走完整 HorizonConn register→reconnect 流程
    void conn;
    void regConn;
    for (const line of results)
        console.log(line);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
void main();
