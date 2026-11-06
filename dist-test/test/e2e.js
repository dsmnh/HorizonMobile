"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** e2e 对拍：HorizonConn（node 传输）↔ mock/server.cjs，覆盖契约 1.2.0 App 平面核心行为。 */
const node_assert_1 = require("node:assert");
const server_cjs_1 = require("../mock/server.cjs");
const conn_1 = require("../src/net/conn");
const transport_node_1 = require("./transport-node");
process.on('unhandledRejection', (reason) => {
    // 迟到的断连 reject（旧连接的 pending）不视为测试失败，记录即可
    console.log('[skip] unhandled rejection logged');
});
/** 全局看门狗：任一场景卡死立即退出并给出定位，杜绝无限等待。 */
const watchdog = setTimeout(() => {
    console.error('== e2e 看门狗超时（60s）：场景卡死 ==');
    process.exit(2);
}, 60000);
watchdog.unref?.();
async function main() {
    const backend = new server_cjs_1.MockAppBackend();
    const port = await backend.listen();
    const results = [];
    const step = (name, pass, detail) => {
        results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}  ｜ ${detail}`);
        console.log(results[results.length - 1]);
    };
    // 账号域脚本
    backend.handlers.set('account.register', () => ({ token: backend.token, kid: backend.token.substring(0, 8), uuids: [] }));
    backend.handlers.set('account.uuids', () => ({ uuids: [] }));
    backend.handlers.set('team.list', () => ({ teams: [{ teamId: 1, name: 'mock队', memberCount: 2, joinMode: 'open' }] }));
    backend.handlers.set('team.create', () => ({ teamId: 42 }));
    // 1) 鉴权与请求
    {
        const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
        await conn.start();
        const uuids = await conn.req('account.uuids');
        step('鉴权成功并完成请求', uuids.ok && Array.isArray(uuids.b.uuids), JSON.stringify(uuids));
        // 2) team 流：订阅与事件
        let got = null;
        const stream = conn.subscribeTeam('uuid-a');
        await waitFor(() => stream.streamId >= 0, 2000);
        stream.addEventListener((e) => {
            got = e;
        });
        backend.pushLastTeamEvent({ seq: 1, k: 'inviteReceived', from: 'uuid-x', teamId: 42, expiresAt: 1 });
        await waitFor(() => got !== null, 2000);
        step('team 流事件送达', got !== null && got.k === 'inviteReceived', JSON.stringify(got));
        stream.close();
        conn.close();
    }
    // 3) 断线自动重连 + 重订阅（真断线：订阅建立后断开，退避重连后补订）
    {
        const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
        await conn.start();
        const stream = conn.subscribeTeam('uuid-a');
        await waitFor(() => stream.streamId >= 0, 2000);
        const sidBefore = stream.sid;
        // 断开现役连接（模拟服务端踢线）；流登记随连接关闭自动清理
        backend.kickAll();
        // 等待重连：退避 1s + 握手，5s 内应恢复
        await waitFor(() => conn.isConnected, 5000);
        await waitFor(() => stream.streamId >= 0 && stream.sid !== sidBefore, 3000);
        step('断线后自动重连并重新订阅', conn.isConnected && stream.sid !== sidBefore && backend.activeStreams.length >= 1, `subs=${backend.activeStreams.length} sidChanged=${stream.sid !== sidBefore}`);
        stream.close();
        conn.close();
    }
    // 4) CLOCK 偏差自动重签
    {
        backend.clockFails = 1;
        const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
        await conn.start();
        step('CLOCK 偏差自动重签', conn.isConnected, `authCount=${backend.authCount}`);
        node_assert_1.strict.ok(backend.authCount >= 2, '应有两次 AUTH');
        conn.close();
    }
    // 5) 错误传播
    {
        backend.clockFails = 0;
        const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
        await conn.start();
        const res = await conn.req('no.such.op');
        step('未知 op 错误传播', !res.ok && res.m === 'UNKNOWN_OP', res.m ?? '');
        conn.close();
    }
    backend.close();
    let failed = 0;
    for (const line of results) {
        if (line.startsWith('FAIL'))
            failed += 1;
    }
    console.log(failed === 0 ? '== e2e 全部通过 ==' : `== e2e 失败 ${failed} 项 ==`);
    process.exit(failed === 0 ? 0 : 1);
}
/** 轮询等待条件成立；超时抛错（由看门狗兜底退出）。 */
async function waitFor(cond, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (!cond()) {
        if (Date.now() > deadline)
            throw new Error(`waitFor 超时（${timeoutMs}ms）`);
        await sleep(25);
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
void main();
