/**
 * Hermes 无全局 Buffer，而协议编解码（src/net/protocol.ts）与连接缓冲（src/net/conn.ts）
 * 依赖 Buffer.alloc/concat。此处在应用入口最早执行，把 buffer 包挂到全局。
 * 必须在 App 之前导入（index.js 首行）。
 */
import { Buffer as BufferPolyfill } from 'buffer';

const g = globalThis as unknown as { Buffer?: typeof BufferPolyfill };
if (!g.Buffer) {
  g.Buffer = BufferPolyfill;
}
