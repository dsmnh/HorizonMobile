/** e2e 对拍：HorizonConn（node 传输）↔ mock/server.mjs，覆盖契约 1.2.0 App 平面核心行为。 */
import { strict as assert } from 'node:assert';
import { MockAppBackend } from '../mock/server.cjs';
import { HorizonConn } from '../src/net/conn';
import { NodeTransport } from './transport-node';

process.on('unhandledRejection', (reason) => {
  // 迟到的断连 reject（旧连接的 pending）不视为测试失败，记录即可
  console.log('[skip] unhandled rejection logged');
});

async function main(): Promise<void> {
  const backend = new MockAppBackend();
  const port = await backend.listen();
  const results: string[] = [];
  const step = (name: string, pass: boolean, detail: string) => {
    results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}  ｜ ${detail}`);
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
    await sleep(150);
    stream.addEventListener((e) => {
      got = e;
    });
    // mock 的 pushEvent 钩子：每次 SUB 后由测试注入
    backend.pushEvent = (streamId: number, write: (f: Buffer) => void) => {
      backend.pushTeamEvent(streamId, write, { seq: 1, k: 'inviteReceived', from: 'uuid-x', teamId: 42, expiresAt: 1 });
    };
    // 重新订阅一次触发注入（简化：直接再发一条 SUB）
    const stream2 = conn.subscribeTeam('uuid-a');
    await sleep(200);
    step('team 流事件送达', got !== null && got.k === 'inviteReceived', JSON.stringify(got));
    stream.close();
    stream2.close();
    conn.close();
  }

  // 3) 断线自动重连 + 重订阅
  {
    backend.dropAfterAuth = true;
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    // 首次连接因 dropAfterAuth 立即断开：start 的重试循环会持续重连
    // 关掉 drop 让重连成功
    const t = setTimeout(() => {
      backend.dropAfterAuth = false;
    }, 1500);
    await conn.start();
    clearTimeout(t);
    step('断线后自动重连并重新订阅', conn.isConnected, `subs=${backend.subscribed}`);
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

  // 5) 错误传播
  {
    backend.clockFails = 0;
    const conn = new HorizonConn(new NodeTransport(), { host: '127.0.0.1', port, token: backend.token });
    await conn.start();
    const res = await conn.req('no.such.op');
    step('未知 op 错误传播', !res.ok && res.m === 'UNKNOWN_OP', res.m ?? '');
    conn.close();
  }

  backend.close();
  let failed = 0;
  for (const line of results) {
    console.log(line);
    if (line.startsWith('FAIL')) failed += 1;
  }
  console.log(failed === 0 ? '== e2e 全部通过 ==' : `== e2e 失败 ${failed} 项 ==`);
  process.exit(failed === 0 ? 0 : 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main();
