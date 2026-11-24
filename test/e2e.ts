/** e2e 对拍：HorizonConn（node 传输）↔ mock/server.cjs，覆盖契约 1.6.0 App 平面核心行为。 */
import { strict as assert } from 'node:assert';
import { MockAppBackend } from '../mock/server.cjs';
import { HorizonConn, type Transport, type TlsOptions } from '../src/net/conn';
import { preauthOp } from '../src/net/preauth';
import { T, FLAG_TLS_BOUND, encodeFrame, jsonFrame } from '../src/net/protocol';
import { fingerprintMatches, normalizeFingerprint } from '../src/net/tls-pin';
import { normalizeUuids } from '../src/net/identity';
import { sharePayload, unsharePayload } from '../src/net/me-payload';
import { fromEvent, fromHistory, isRelevant } from '../src/net/chat-merge';
import { NodeTransport } from './transport-node';

process.on('unhandledRejection', (reason) => {
  // 迟到的断连 reject（旧连接的 pending）不视为测试失败，记录即可
  console.log('[skip] unhandled rejection logged:', String(reason).split('\n')[0]);
});

/** 全局看门狗：任一场景卡死立即退出并给出定位，杜绝无限等待。 */
const watchdog = setTimeout(() => {
  console.error('== e2e 看门狗超时（60s）：场景卡死 ==');
  process.exit(2);
}, 60_000);
watchdog.unref?.();

async function main(): Promise<void> {
  const backend = new MockAppBackend();
  const port = await backend.listen();
  const results: string[] = [];
  const step = (name: string, pass: boolean, detail: string) => {
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
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const uuids = await conn.req('account.uuids');
    step('鉴权成功并完成请求', uuids.ok && Array.isArray(uuids.b.uuids), JSON.stringify(uuids));

    // 2) team 流：订阅与事件
    let got: any = null;
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
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const stream = conn.subscribeTeam('uuid-a');
    await waitFor(() => stream.streamId >= 0, 2000);
    const sidBefore = stream.sid;
    const closed = conn.subscribeStream('chat', { uuid: 'old-identity' });
    await waitFor(() => closed.streamId >= 0, 2000);
    closed.close();
    const closedBeforeReply = conn.subscribeStream('chat', { uuid: 'closed-before-reply' });
    closedBeforeReply.close();
    await waitFor(() => backend.activeStreams.length === 1, 2000);
    // 断开现役连接（模拟服务端踢线）；流登记随连接关闭自动清理
    backend.kickAll();
    // 等待重连：退避 1s + 握手，5s 内应恢复
    await waitFor(() => conn.isConnected, 5000);
    await waitFor(() => stream.streamId >= 0 && stream.sid !== sidBefore, 3000);
    step('断线后自动重连并重新订阅', conn.isConnected && stream.sid !== sidBefore && backend.activeStreams.length === 1 && closed.streamId === -1,
      `subs=${backend.activeStreams.length} sidChanged=${stream.sid !== sidBefore}`);
    stream.close();
    conn.close();
  }

  // 4) CLOCK 偏差自动重签
  {
    backend.clockFails = 1;
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    step('CLOCK 偏差自动重签', conn.isConnected, `authCount=${backend.authCount}`);
    assert.ok(backend.authCount >= 2, '应有两次 AUTH');
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

  backend.handlers.set('chat.private.send', () => ({ ts: 3, mid: 3 }));
  backend.handlers.set('friend.request', () => ({ requestId: 5, expiresAt: 99 }));
  backend.handlers.set('friend.accept', () => ({}));
  backend.handlers.set('friend.remove', () => ({}));
  backend.handlers.set('block.set', () => ({}));

  backend.handlers.set('rank.sync', () => ({ queued: true }));
  backend.handlers.set('silent.op', () => undefined); // 不回包（超时用例）

  backend.handlers.set('me.list', () => ({ devices: [{ deviceId: 'dev-1', nodeId: 1, owner: 'uuid-a', kind: 'me', shared: [] }] }));
  backend.handlers.set('me.share', () => ({}));
  backend.handlers.set('me.unshare', () => ({}));

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
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const res = await conn.req('no.such.op');
    step('未知 op 错误传播', !res.ok && res.m === 'UNKNOWN_OP', res.m ?? '');
    conn.close();
  }

  // 6) chat 流：订阅、定向投递、UNSUB 停投
  {
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const chatA = conn.subscribeStream('chat', { uuid: 'uuid-a' });
    const chatB = conn.subscribeStream('chat', { uuid: 'uuid-b' });
    await waitFor(() => chatA.streamId >= 0 && chatB.streamId >= 0, 2000);

    let gotA: any = null;
    let gotB: any = null;
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
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const chat = conn.subscribeStream('chat', { uuid: 'uuid-a' });
    await waitFor(() => chat.streamId >= 0, 2000);

    let event: any = null;
    chat.addEventListener((e) => { event = e; });
    const hist = await conn.req('chat.history', { uuid: 'uuid-a', scope: 'public', limit: 50 });
    step('chat.history 拉取', hist.ok && Array.isArray(hist.b?.messages) && hist.b.messages.length === 1,
      JSON.stringify(hist.b));
    const send = await conn.req('chat.public.send', { uuid: 'uuid-a', text: 'hi' });
    await waitFor(() => event !== null, 2000);
    step('chat.public.send 回显经流送达', send.ok && event?.k === 'msg' && event?.text === 'hi' && event?.from === 'uuid-a',
      `res=${JSON.stringify(send.b)} event=${JSON.stringify(event)}`);
    chat.close();
    conn.close();
  }

  // 8) 队伍操作 roundtrip：create → info → joinmode → disband（mock 脚本化）
  {
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const created = await conn.req('team.create', { uuid: 'uuid-a', name: 'op队' });
    const info = await conn.req('team.info', { uuid: 'uuid-a' });
    const mode = await conn.req('team.setJoinMode', { uuid: 'uuid-a', mode: 'open' });
    const disband = await conn.req('team.disband', { uuid: 'uuid-a' });
    step('队伍操作 roundtrip',
      created.ok && created.b?.teamId === 42 && info.ok && mode.ok && disband.ok,
      `create=${created.b?.teamId} info=${info.ok} mode=${mode.ok} disband=${disband.ok}`);

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
    step('成员与审批 roundtrip',
      membersOk && inv.ok && acc.ok && dec.ok && app.ok && appr.ok && deny.ok && kick.ok && role.ok && xfer.ok,
      `info=${membersOk} inv=${inv.b?.inviteId} acc=${acc.ok} dec=${dec.ok} app=${app.b?.applyId} appr=${appr.ok} deny=${deny.ok} kick=${kick.ok} role=${role.ok} xfer=${xfer.ok}`);
    conn.close();
  }

  // 10) 私聊双向回显 + 好友/屏蔽 roundtrip
  {
    const connA = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    const connB = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await connA.start();
    await connB.start();
    const chatA = connA.subscribeStream('chat', { uuid: 'uuid-a' });
    const chatB = connB.subscribeStream('chat', { uuid: 'uuid-b' });
    await waitFor(() => chatA.streamId >= 0 && chatB.streamId >= 0, 2000);
    let gotA: any = null;
    let gotB: any = null;
    chatA.addEventListener((e) => { gotA = e; });
    chatB.addEventListener((e) => { gotB = e; });

    const send = await connA.req('chat.private.send', { uuid: 'uuid-a', to: 'uuid-b', text: 'psst' });
    await waitFor(() => gotA !== null && gotB !== null, 2000);
    const bothGot = gotA?.text === 'psst' && gotB?.text === 'psst' && gotA?.scope === 'private' && gotB?.scope === 'private';

    const fr = await connA.req('friend.request', { uuid: 'uuid-a', to: 'uuid-b' });
    const fa = await connB.req('friend.accept', { uuid: 'uuid-b', requestId: fr.b?.requestId });
    const frm = await connA.req('friend.remove', { uuid: 'uuid-a', target: 'uuid-b' });
    const bl = await connA.req('block.set', { uuid: 'uuid-a', target: 'uuid-b', blocked: true });
    const ub = await connA.req('block.set', { uuid: 'uuid-a', target: 'uuid-b', blocked: false });
    step('私聊双向回显 + 好友/屏蔽 roundtrip',
      send.ok && bothGot && fr.ok && fa.ok && frm.ok && bl.ok && ub.ok,
      `send=${send.ok} both=${bothGot} fr=${fr.b?.requestId} acc=${fa.ok} rm=${frm.ok} block=${bl.ok}/${ub.ok}`);

    chatA.close(); chatB.close();
    connA.close(); connB.close();
  }

  // 11) ME 设备域 roundtrip
  {
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const list = await conn.req('me.list', { uuid: 'uuid-a' });
    const share = await conn.req('me.share', { uuid: 'uuid-a', deviceId: 'dev-1', target: 'uuid-b', level: 'control' });
    const unshare = await conn.req('me.unshare', { uuid: 'uuid-a', deviceId: 'dev-1' });
    step('ME 设备域 roundtrip', list.ok && list.b?.devices?.length === 1 && share.ok && unshare.ok,
      `list=${list.b?.devices?.length} share=${share.ok} unshare=${unshare.ok}`);
    conn.close();
  }

  // 12) rank.sync roundtrip
  {
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const sync = await conn.req('rank.sync', { uuid: 'uuid-a', nodeId: 1 });
    step('rank.sync roundtrip', sync.ok && sync.b?.queued === true, JSON.stringify(sync.b));
    conn.close();
  }

  // 13) 重连风暴硬化：短窗内连续两次踢线，重连后仍恰好一次补订、authCount 有界
  {
    backend.clockFails = 0;
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const authBefore = backend.authCount;
    const stream = conn.subscribeStream('team', { uuid: 'uuid-a' });
    await waitFor(() => stream.streamId >= 0, 2000);
    const sid1 = stream.sid;
    backend.kickAll();
    await waitFor(() => conn.isConnected, 6000);
    await waitFor(() => stream.sid !== sid1, 3000);
    // 第一次重连完成后二次踢线：确定性验证多轮重连不循环倍增
    const sid2 = stream.sid;
    const authAfterFirst = backend.authCount;
    backend.kickAll();
    await waitFor(() => conn.isConnected, 6000);
    await waitFor(() => stream.sid !== sid2, 3000);
    const authDelta = backend.authCount - authBefore;
    const authSecond = backend.authCount - authAfterFirst;
    // 两轮各恰一次鉴权（单飞；>3 即存在循环倍增）
    step('重连风暴硬化（两轮踢线）', authDelta === 2 && authSecond === 1 && sid1 !== sid2,
      `authDelta=${authDelta}（第二轮=${authSecond}，sid 两轮均变更）`);
    stream.close();
    conn.close();
  }

  // 14) 边界路径：预鉴权错误结构 + REQ 超时
  {
    // 重复账号名注册：mock 无此校验，改用未知 op 的结构化错误路径
    const bad = await preauthOp(new NodeTransport(), '127.0.0.1', port, 'no.such.preauth', {});
    step('预鉴权错误结构化传播', !bad.ok && typeof bad.m === 'string' && bad.m.length > 0,
      `m=${bad.m}`);
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token, requestTimeoutMs: 800 });
    await conn.start();
    const t0 = Date.now();
    let timedOut = false;
    try {
      await conn.req('silent.op');
    } catch (e: any) {
      timedOut = e.message.includes('超时') && Date.now() - t0 < 3000;
    }
    step('REQ 超时按 requestTimeoutMs 触发', timedOut, `elapsed=${Date.now() - t0}ms`);
    conn.close();
  }

  // 15) 新增界面入口的契约参数对拍（team.invite / rank.sync / admin.opSet / account.uuids / me.query）
  {
    const seen: Record<string, any> = {};
    backend.handlers.set('team.invite', (p: any) => { seen.invite = p; return { inviteId: 9, expiresAt: 1 }; });
    backend.handlers.set('rank.sync', (p: any) => { seen.rank = p; return { queued: true }; });
    backend.handlers.set('admin.opSet', (p: any) => { seen.opSet = p; return { queued: false, nodeId: p.nodeId }; });
    backend.handlers.set('account.uuids', () => ({ uuids: [{ uuid: 'uuid-a', name: '测试玩家' }] }));
    backend.handlers.set('me.query', (p: any) => p.queryId
      ? { items: [{ item: 'minecraft:iron_ingot', count: 4 }], pending: false }
      : { pending: true, queryId: 'query-160' });

    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const invite = await conn.req('team.invite', { uuid: 'uuid-a', target: 'uuid-b' });
    const rank = await conn.req('rank.sync', { uuid: 'uuid-a', nodeId: 1 });
    const opSet = await conn.req('admin.opSet', { uuid: 'uuid-b', nodeId: 1, grant: true });
    const ids = await conn.req('account.uuids', {});
    const first = await conn.req('me.query', { uuid: 'uuid-a', deviceId: 'dev-1' });
    const polled = await conn.req('me.query', { queryId: first.b.queryId });
    step('新增界面入口参数对齐契约 1.6.0',
      invite.ok && seen.invite?.target === 'uuid-b'
      && rank.ok && seen.rank?.uuid === 'uuid-a' && seen.rank?.nodeId === 1
      && opSet.ok && seen.opSet?.grant === true
      && ids.b?.uuids?.[0]?.name === '测试玩家'
      && first.b?.pending === true && polled.b?.items?.[0]?.count === 4,
      `invite=${seen.invite?.target} rank.uuid=${seen.rank?.uuid} opSet.grant=${seen.opSet?.grant} query=${first.b?.queryId}`);
    conn.close();
  }

  // 16) 契约 §9.1：TLS 连接所有帧带 0x02，缺标记的入帧按降级剥离终止
  {
    const transport = new InMemoryTransport();
    let fatal = '';
    const conn = new HorizonConn(transport, {
      host: '127.0.0.1', port: 1, token: backend.token, tls: true,
      onFatal: (code) => { fatal = code; },
    });
    const started = conn.start();
    await sleep(20);
    const helloBound = transport.written.length === 1
      && (transport.written[0][5] & FLAG_TLS_BOUND) !== 0;
    transport.inject(jsonFrame(T.HELLO_ACK, {
      v: 1, name: 'Mock', ver: '0.0.0', time: Math.floor(Date.now() / 1000),
      nonce: 'nonce-tls', caps: [], plane: 'app',
    }, FLAG_TLS_BOUND));
    await sleep(20);
    transport.inject(encodeFrame(T.AUTH_OK, Buffer.from(JSON.stringify({ role: 'user' })), FLAG_TLS_BOUND));
    await started;
    const allBound = transport.written.every((f) => (f[5] & FLAG_TLS_BOUND) !== 0);
    transport.inject(jsonFrame(T.PUSH, { s: 1, f: {} }, 0));
    step('TLS 逐帧绑定与降级剥离终止',
      helloBound && allBound && fatal === 'TLS_FLAGS_MISMATCH' && !conn.isConnected,
      `frames=${transport.written.length} fatal=${fatal}`);
    conn.close();
  }

  // 17) 证书指纹规范化与固定判定（RN 与 node 传输共用）
  {
    const plain = 'AB'.repeat(32);
    const colon = Array.from({ length: 32 }, () => 'AB').join(':');
    const ok = fingerprintMatches(colon, plain)
      && !fingerprintMatches(plain, 'CD'.repeat(32))
      && !fingerprintMatches('not-a-fingerprint', plain)
      && normalizeFingerprint(colon) === plain.toLowerCase();
    step('证书指纹规范化与固定判定', ok, `normalize=${normalizeFingerprint(colon).slice(0, 8)}…`);
  }

  // 18) 预鉴权同样受 TLS 逐帧绑定约束（契约 §9.1）：连接参数与出帧标记一处决定
  {
    const transport = new InMemoryTransport();
    let seenTls: TlsOptions | undefined;
    const rawConnect = transport.connect.bind(transport);
    transport.connect = async (h: string, pt: number, tlsOpts?: TlsOptions) => {
      seenTls = tlsOpts;
      await rawConnect(h, pt, tlsOpts);
    };
    const pending = preauthOp(transport, '127.0.0.1', 44444, 'account.register',
      { name: 'tls-user', pass: 'p' }, 3000, { enabled: true });
    await sleep(20);
    transport.inject(jsonFrame(T.HELLO_ACK, {
      v: 1, name: 'Mock', ver: '0.0.0', time: Math.floor(Date.now() / 1000),
      nonce: 'nonce-preauth', caps: [], plane: 'app',
    }, FLAG_TLS_BOUND));
    await sleep(20);
    transport.inject(encodeFrame(T.RES, Buffer.from(JSON.stringify({ ok: true, b: { token: 'tk-preauth' } })), FLAG_TLS_BOUND));
    const pres = await pending;
    const allBound = transport.written.length === 2
      && transport.written.every((f) => (f[5] & FLAG_TLS_BOUND) !== 0);
    step('预鉴权 TLS 逐帧绑定',
      seenTls?.enabled === true && allBound && pres.ok && pres.b?.token === 'tk-preauth',
      `tls=${seenTls?.enabled} frames=${transport.written.length}`);
  }

  // 19) account.uuids 条目归一化（契约 1.6.0 §8.7 起为 {uuid,name} 对象）
  {
    const objs = normalizeUuids([{ uuid: 'uuid-a', name: '甲' }, { uuid: 'uuid-b' }]);
    const mixed = normalizeUuids(['uuid-c', { uuid: 'uuid-d' }, null, { name: '无 uuid' }, 42]);
    const empty = normalizeUuids(undefined);
    step('绑定身份条目归一化',
      objs.length === 2 && objs[0] === 'uuid-a' && objs[1] === 'uuid-b'
      && mixed.length === 2 && mixed[0] === 'uuid-c' && mixed[1] === 'uuid-d'
      && empty.length === 0,
      `objs=${objs.join(',')} mixed=${mixed.join(',')}`);
  }

  // 20) ME 共享载荷：取消共享同样需要 target，缺键会被后端 BAD_PARAMS 拒绝
  {
    const share = sharePayload('uuid-a', ' dev-1 ', ' uuid-b ');
    const unshare = unsharePayload('uuid-a', ' dev-1 ', ' uuid-b ');
    step('ME 共享载荷含目标身份',
      share.target === 'uuid-b' && unshare.target === 'uuid-b'
      && share.deviceId === 'dev-1' && unshare.deviceId === 'dev-1'
      && share.level === 'control',
      `share.target=${share.target} unshare.target=${unshare.target}`);
  }

  // 21) 聊天归一化：历史用 id、事件用 seq，公聊事件无 scope，私聊按双方判定
  {
    const h = fromHistory({ id: 7, from: 'u1', text: '历史', ts: 100 });
    const missing = fromHistory({ from: 'u2', text: '无 id', ts: 5 });
    const pub = isRelevant({ k: 'msg', from: 'u1', text: 'x' }, 'public', '', 'u1');
    const privMine = isRelevant({ k: 'msg', private: true, from: 'u9', to: 'u1' }, 'private', 'u9', 'u1');
    const privOther = isRelevant({ k: 'msg', private: true, from: 'u8', to: 'u7' }, 'private', 'u9', 'u1');
    const ev = fromEvent({ from: 'u1', text: 'e' }, 3);
    step('聊天归一化键名与频道判定',
      h.mid === 7 && missing.mid !== undefined && String(missing.mid).startsWith('h-')
      && pub && privMine && !privOther && ev.mid === 3,
      `hist=${h.mid} fallback=${missing.mid} pub=${pub} priv=${privMine}/${privOther}`);
  }

  // 22) 重连期遇到终止性错误（如服务端换证导致指纹不匹配）必须上报，否则界面永远停在「自动重连中」
  {
    const transport = new InMemoryTransport();
    let fatal = '';
    let connects = 0;
    const rawConnect = transport.connect.bind(transport);
    transport.connect = async (h: string, p: number, tlsOpts?: TlsOptions) => {
      connects += 1;
      // 首连成功后模拟服务端换证：重连时指纹校验失败，传输层抛终止性错误
      if (connects > 1) {
        throw Object.assign(new Error('CERT_FINGERPRINT_MISMATCH'), { terminal: true });
      }
      await rawConnect(h, p, tlsOpts);
    };
    const conn = new HorizonConn(transport, {
      host: '127.0.0.1', port: 1, token: backend.token, tls: true,
      onFatal: (code) => { fatal = code; },
    });
    const started = conn.start();
    await sleep(20);
    transport.inject(jsonFrame(T.HELLO_ACK, {
      v: 1, name: 'Mock', ver: '0.0.0', time: Math.floor(Date.now() / 1000),
      nonce: 'nonce-reconnect', caps: [], plane: 'app',
    }, FLAG_TLS_BOUND));
    await sleep(20);
    transport.inject(encodeFrame(T.AUTH_OK, Buffer.from(JSON.stringify({ role: 'user' })), FLAG_TLS_BOUND));
    await started;
    const beforeDrop = conn.isConnected;
    transport.drop();
    await sleep(200);
    step('重连遇终止性错误上报',
      beforeDrop && fatal === 'CERT_FINGERPRINT_MISMATCH' && !conn.isConnected && connects === 2,
      `fatal=${fatal} connects=${connects}`);
    conn.close();
  }

  backend.close();
  let failed = 0;
  for (const line of results) {
    if (line.startsWith('FAIL')) failed += 1;
  }
  console.log(failed === 0 ? '== e2e 全部通过 ==' : `== e2e 失败 ${failed} 项 ==`);
  process.exit(failed === 0 ? 0 : 1);
}

/** 轮询等待条件成立；超时抛错（由看门狗兜底退出）。 */
async function waitFor(cond: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error(`waitFor 超时（${timeoutMs}ms）`);
    await sleep(25);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 内存传输：不建立真实 TLS 会话，用于断言连接层的出帧标记与入帧一致性判定。 */
class InMemoryTransport implements Transport {
  readonly written: Buffer[] = [];
  private dataCb: ((chunk: Buffer) => void) | null = null;
  private closeCb: (() => void) | null = null;

  async connect(_host: string, _port: number, _tls?: TlsOptions): Promise<void> {}

  write(data: Buffer): void {
    this.written.push(data);
  }

  onData(cb: (chunk: Buffer) => void): void {
    this.dataCb = cb;
  }

  onClose(cb: () => void): void {
    this.closeCb = cb;
  }

  close(): void {
    this.closeCb?.();
  }

  /** 只触发 close 回调，模拟服务端断开而不销毁测试对象本身。 */
  drop(): void {
    this.closeCb?.();
  }

  inject(frame: Buffer): void {
    this.dataCb?.(frame);
  }
}

void main();
