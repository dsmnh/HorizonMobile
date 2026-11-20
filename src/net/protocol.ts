/**
 * Horizon App 平面协议（契约 1.6.0）：帧编解码与常量。
 * 传输无关：只处理字节 <-> Frame，socket 由 conn.ts 注入。
 * flags 0x02 为逐帧 TLS 绑定标记（§9.1），由连接层统一置位与校验。
 */

export const PROTOCOL_VERSION = 1;
export const MAX_FRAME_BYTES = 16 * 1024 * 1024;
/** 逐帧 TLS 绑定标记（契约 §9.1）；TLS 连接上所有帧置位，明文连接不得置位。 */
export const FLAG_TLS_BOUND = 0x02;

/** 帧类型（登记表 §1），值一经发布不得改动。 */
export const T = {
  HELLO: 0x01,
  HELLO_ACK: 0x02,
  AUTH: 0x03,
  AUTH_OK: 0x04,
  AUTH_FAIL: 0x05,
  REQ: 0x10,
  RES: 0x11,
  SUB: 0x20,
  SUB_OK: 0x21,
  PUSH: 0x22,
  UNSUB: 0x23,
  PING: 0x30,
  PONG: 0x31,
  ERR: 0x40,
} as const;

export interface Frame {
  type: number;
  flags: number;
  payload: Buffer;
}

/** 读一帧；返回 null 表示流正常结束；长度非法抛 Error（调用方断开）。 */
export function readFrame(readExact: (n: number) => Buffer): Frame | null {
  let lenBuf: Buffer;
  try {
    lenBuf = readExact(4);
  } catch (e: any) {
    if (e && e.eof) return null;
    throw e;
  }
  const len = lenBuf.readUInt32BE(0);
  if (len < 2 || len > MAX_FRAME_BYTES) {
    throw new Error('bad frame length: ' + len);
  }
  const rest = readExact(len);
  // slice 保持 Buffer 原型：垫片的 subarray 返回裸 Uint8Array，无法按编码解码
  return { type: rest[0], flags: rest[1], payload: rest.slice(2) };
}

/** 编码一帧（len = type + flags + payload 的总字节数，大端）；flags 缺省为 0。 */
export function encodeFrame(type: number, payload?: Buffer, flags = 0): Buffer {
  const body = payload ?? Buffer.alloc(0);
  const out = Buffer.alloc(4 + 2 + body.length);
  out.writeUInt32BE(body.length + 2, 0);
  out[4] = type;
  out[5] = flags & 0xff;
  body.copy(out, 6);
  return out;
}

export function jsonFrame(type: number, obj: unknown, flags = 0): Buffer {
  return encodeFrame(type, Buffer.from(JSON.stringify(obj), 'utf8'), flags);
}
