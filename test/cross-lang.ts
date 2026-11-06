/** 跨语言互操作探针：TS 协议栈 ↔ 真后端 JAR。用法：node dist-test/test/cross-lang.js [端口] */
import { HorizonConn } from '../src/net/conn';
import { preauthOp } from '../src/net/preauth';
import { NodeTransport } from './transport-node';

const HOST = '127.0.0.1';
const PORT = parseInt(process.argv[2] ?? '44544', 10);

async function main(): Promise<void> {
  const results: string[] = [];
  const step = (name: string, pass: boolean, detail: string) => {
    const line = `${pass ? 'PASS' : 'FAIL'}  ${name}  ｜ ${detail}`;
    results.push(line);
    console.log(line);
  };

  console.log(`真后端 ${HOST}:${PORT} 跨语言探针`);
  const name = `probe-${Date.now() % 1000000}`;
  const pass = 'probe-password-123';
  const reg = await preauthOp(new NodeTransport(), HOST, PORT, 'account.register', { name, pass });
  const token: string = reg.b?.token;
  step('预鉴权 register（裸帧 ↔ Java）', !!token, `token kid=${token.substring(0, 8)}`);

  const conn = new HorizonConn(new NodeTransport(), { host: HOST, port: PORT, token });
  await conn.start();
  step('HELLO/AUTH（noble HMAC ↔ Java）', conn.isConnected, '会话已建立');

  const uuids = await conn.req('account.uuids');
  step('鉴权域 REQ 往返 account.uuids', uuids.ok, JSON.stringify(uuids.b ?? uuids.m));

  const create = await conn.req('team.create', { name: `探针队-${Date.now() % 100000}` });
  // 未绑定 UUID 时后端按契约拒绝（FORBIDDEN/NO_UUID），能收到结构化 RES 即证明错误路径贯通
  step('team.create 错误路径贯通', typeof create.ok === 'boolean', `ok=${create.ok} m=${create.m ?? '-'}`);

  // 会话生命周期：同账号第二会话 → 列表 → 撤销另一会话 → 列表收敛
  const login2 = await preauthOp(new NodeTransport(), HOST, PORT, 'account.login', { name, pass });
  const token2: string = login2.b?.token;
  step('同账号二次 login（新会话）', !!token2 && token2 !== token, 'token 不同=会话独立');

  const before = await conn.req('account.sessions');
  const list0 = before.b?.sessions ?? [];
  const other = list0.find((s: any) => !s.current);
  step('account.sessions 列出双会话', before.ok && list0.length >= 2 && !!other,
    `n=${list0.length} current 标记=${list0.filter((s: any) => s.current).length}`);

  const revoke = await conn.req('account.revokeSession', { id: other.id });
  const after = await conn.req('account.sessions');
  const list1 = after.b?.sessions ?? [];
  step('revokeSession 撤销另一会话后列表收敛', revoke.ok && list1.length === list0.length - 1,
    `${list0.length} -> ${list1.length}`);

  conn.close();
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(failed === 0 ? '== 跨语言探针全部通过 ==' : `== 跨语言探针失败 ${failed} 项 ==`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('探针异常：', e.message);
  process.exit(2);
});
