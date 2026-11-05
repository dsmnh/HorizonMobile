/** 重连时序探针：隔离场景 2（dropAfterAuth 重连），逐帧 dump 定位 HELLO 缺失。 */
import { strict as assert } from 'node:assert';
import { MockAppBackend } from '../mock/server.cjs';
import { HorizonConn } from '../src/net/conn';
import { NodeTransport } from './transport-node';

async function main(): Promise<void> {
  const backend = new MockAppBackend();
  const port = await backend.listen();
  backend.handlers.set('account.uuids', () => ({ uuids: [] }));

  backend.dropAfterAuth = true;
  const conn = new HorizonConn(new NodeTransport(), {
    host: '127.0.0.1', port, token: backend.token,
    backoffInitialMs: 100, requestTimeoutMs: 5000,
  });
  const timer = setTimeout(() => {
    backend.dropAfterAuth = false;
  }, 1200);
  await conn.start();
  clearTimeout(timer);
  console.log('[probe] reconnected, authed=', conn.isConnected);
  const uuids = await conn.req('account.uuids');
  console.log('[probe] req ok=', uuids.ok);
  conn.close();
  backend.close();
  console.log('== 探针完成 ==');
}

void main();
