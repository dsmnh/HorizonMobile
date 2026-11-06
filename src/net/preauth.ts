/**
 * 预鉴权操作（契约 §4.1 白名单：account.register/login/resetPassword、node.register）：
 * 在建立会话（AUTH）之前直发 REQ，用于换取会话 token。
 * 传输无关：测试注入 NodeTransport，RN 运行时注入 RnTransport。
 */
import { T, jsonFrame } from './protocol';
import type { Transport } from './conn';

export interface PreauthRes<T = any> {
  ok: boolean;
  b: T;
  m?: string;
}

/** 单次预鉴权 op：建连 → HELLO → REQ → 拿 RES 即断。 */
export async function preauthOp(
  transport: Transport,
  host: string,
  port: number,
  op: string,
  p: unknown,
  timeoutMs = 15_000,
): Promise<PreauthRes> {
  let buffer = Buffer.alloc(0);
  let gotNonce = false;
  await transport.connect(host, port);

  const result = await new Promise<PreauthRes>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`预鉴权超时：${op}`)), timeoutMs);
    const finish = (r: PreauthRes) => {
      clearTimeout(timer);
      transport.close();
      resolve(r);
    };
    transport.onData((chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        if (buffer.length < 4) return;
        const len = buffer.readUInt32BE(0);
        if (buffer.length < 4 + len) return;
        // len 已含 type+flags：raw = [4, 4+len)，残留自 4+len 起
        const raw = buffer.subarray(4, 4 + len);
        buffer = buffer.subarray(4 + len);
        const type = raw[0];
        const body = raw.length > 2 ? safeJson(raw.subarray(2)) : {};
        if (type === T.HELLO_ACK) {
          gotNonce = true;
          transport.write(jsonFrame(T.REQ, { id: 1, op, p }));
        } else if (type === T.RES && gotNonce) {
          finish({ ok: !!body.ok, b: body.b, m: body.m ?? undefined });
          return;
        } else if (type === T.ERR) {
          finish({ ok: false, b: null, m: body.m ?? 'ERR' });
          return;
        }
      }
    });
    transport.write(jsonFrame(T.HELLO, { v: 1, app: 'HorizonMobile/0.1.0', plane: 'app' }));
  });
  return result;
}

function safeJson(payload: Buffer): any {
  try {
    return JSON.parse(payload.toString('utf8'));
  } catch {
    return {};
  }
}
