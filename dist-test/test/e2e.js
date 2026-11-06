"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** e2e 对拍：HorizonConn（node 传输）↔ mock/server.cjs，覆盖契约 1.2.0 App 平面核心行为。 */
const node_assert_1 = require("node:assert");
const server_cjs_1 = require("../mock/server.cjs");
const conn_1 = require("../src/net/conn");
const transport_node_1 = require("./transport-node");
process.on('unhandledRejection', (reason) => {
    // 迟到的断连 reject（旧连接的 pending）不视为测试失败，记录即可
    console.log('[skip] unhandled rejection logged:', String(reason).split('\n')[0]);
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
    // 聊天域脚本（场景 7 用）
    backend.handlers.set('chat.history', () => ({
        messages: [
            { mid: 1, from: 'uuid-old', text: '历史消息', ts: 1 },
        ],
        more: false,
    }));
    backend.handlers.set('chat.public.send', () => ({ ts: 2, mid: 2 }));
    backend.handlers.set('team.leave', () => ({}));
    backend.handlers.set('team.disband', () => ({}));
    backend.handlers.set('team.info', () => ({ team: { teamId: 42, name: 'mock队', joinMode: 'open', members: [{ uuid: 'uuid-a', role: 'leader' }, { uuid: 'uuid-b', role: 'member' }] } }));
    backend.handlers.set('team.invite', () => ({ inviteId: 9, expiresAt: 99 }));
    backend.handlers.set('team.acceptInvite', () => ({ teamId: 42 }));
    backend.handlers.set('team.declineInvite', () => ({}));
    backend.handlers.set('team.apply', () => ({ applyId: 7, expiresAt: 99 }));
    backend.handlers.set('team.approveApply', () => ({ teamId: 42 }));
    backend.handlers.set('team.denyApply', () => ({}));
    backend.handlers.set('team.kick', () => ({}));
    backend.handlers.set('team.setRole', () => ({}));
    backend.handlers.set('team.transfer', () => ({}));
    backend.handlers.set('team.setJoinMode', () => ({}));
    // 5) 错误传播
    {
        backend.clockFails = 0;
        const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
        await conn.start();
        const res = await conn.req('no.such.op');
        step('未知 op 错误传播', !res.ok && res.m === 'UNKNOWN_OP', res.m ?? '');
        conn.close();
    }
    // 6) chat 流：订阅、定向投递、UNSUB 停投
    {
        const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
        await conn.start();
        const chatA = conn.subscribeStream('chat', { uuid: 'uuid-a' });
        const chatB = conn.subscribeStream('chat', { uuid: 'uuid-b' });
        await waitFor(() => chatA.streamId >= 0 && chatB.streamId >= 0, 2000);
        let gotA = null;
        let gotB = null;
        chatA.addEventListener((e) => { gotA = e; });
        chatB.addEventListener((e) => { gotB = e; });
        backend.pushChatEvent('uuid-a', { k: 'msg', mid: 7, from: 'uuid-x', text: 'hi' });
        await waitFor(() => gotA !== null, 2000);
        const directedOk = gotA?.k === 'msg' && gotB === null;
        step('chat 流事件定向送达（uuid-a 收到，uuid-b 不串流）', directedOk, `A=${JSON.stringify(gotA)} B=${gotB}`);
        chatA.close();
        await sleep(100);
        backend.pushChatEvent('uuid-b', { k: 'msg', mid: 8, from: 'uuid-y', text: 'yo' });
        await waitFor(() => gotB !== null, 2000);
        // chatA 已 UNSUB：mock 登记移除，A 不得再收到任何推送
        const aCount = backend.chatStreamCount('uuid-a');
        step('UNSUB 后停止投递', aCount === 0 && gotB?.mid === 8, `chatA 登记=${aCount} B=${JSON.stringify(gotB)}`);
        chatB.close();
        conn.close();
    }
    // 7) 聊天域：history 拉取 + public.send 回显经 chat 流送达发送者
    {
        const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
        await conn.start();
        const chat = conn.subscribeStream('chat', { uuid: 'uuid-a' });
        await waitFor(() => chat.streamId >= 0, 2000);
        let event = null;
        chat.addEventListener((e) => { event = e; });
        const hist = await conn.req('chat.history', { uuid: 'uuid-a', scope: 'public', limit: 50 });
        step('chat.history 拉取', hist.ok && Array.isArray(hist.b?.messages) && hist.b.messages.length === 1, JSON.stringify(hist.b));
        const send = await conn.req('chat.public.send', { uuid: 'uuid-a', text: 'hi' });
        await waitFor(() => event !== null, 2000);
        step('chat.public.send 回显经流送达', send.ok && event?.k === 'msg' && event?.text === 'hi' && event?.from === 'uuid-a', `res=${JSON.stringify(send.b)} event=${JSON.stringify(event)}`);
        chat.close();
        conn.close();
    }
    // 8) 队伍操作 roundtrip：create → info → joinmode → disband（mock 脚本化）
    {
        const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
        await conn.start();
        const created = await conn.req('team.create', { uuid: 'uuid-a', name: 'op队' });
        const info = await conn.req('team.info', { uuid: 'uuid-a' });
        const mode = await conn.req('team.setJoinMode', { uuid: 'uuid-a', mode: 'open' });
        const disband = await conn.req('team.disband', { uuid: 'uuid-a' });
        step('队伍操作 roundtrip', created.ok && created.b?.teamId === 42 && info.ok && mode.ok && disband.ok, `create=${created.b?.teamId} info=${info.ok} mode=${mode.ok} disband=${disband.ok}`);
        // 9) 成员与审批 roundtrip：info(成员)→invite→acceptInvite→apply→approveApply→kick→setRole→transfer→denyApply
        const roster = await conn.req('team.info', { uuid: 'uuid-a' });
        const membersOk = roster.ok && roster.b?.team?.members?.length === 2;
        const inv = await conn.req('team.invite', { uuid: 'uuid-a', target: 'uuid-c' });
        const acc = await conn.req('team.acceptInvite', { uuid: 'uuid-c', inviteId: inv.b?.inviteId });
        const dec = await conn.req('team.declineInvite', { uuid: 'uuid-c', inviteId: 1 });
        const app = await conn.req('team.apply', { uuid: 'uuid-c', teamId: 42 });
        const appr = await conn.req('team.approveApply', { uuid: 'uuid-a', applyId: app.b?.applyId });
        const deny = await conn.req('team.denyApply', { uuid: 'uuid-a', applyId: 1 });
        const kick = await conn.req('team.kick', { uuid: 'uuid-a', target: 'uuid-b' });
        const role = await conn.req('team.setRole', { uuid: 'uuid-a', target: 'uuid-b', role: 'vice' });
        const xfer = await conn.req('team.transfer', { uuid: 'uuid-a', target: 'uuid-b' });
        step('成员与审批 roundtrip', membersOk && inv.ok && acc.ok && dec.ok && app.ok && appr.ok && deny.ok && kick.ok && role.ok && xfer.ok, `info=${membersOk} inv=${inv.b?.inviteId} acc=${acc.ok} dec=${dec.ok} app=${app.b?.applyId} appr=${appr.ok} deny=${deny.ok} kick=${kick.ok} role=${role.ok} xfer=${xfer.ok}`);
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
