/**
 * react-native-tcp-socket 传输适配器（RN 运行时用；测试环境用 test/transport-node.ts）。
 * 实现 conn.ts 的 Transport 接口。依赖：react-native-tcp-socket（expo 51 项目按需安装）。
 *
 * 注意：RN 环境无 Buffer polyfill 时需引入 buffer 包（AEMobileApp 底座已含 buffer 依赖）。
 */
import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';

export class RnTransport {
  private socket: any = null;
  private dataCb: ((chunk: Buffer) => void) | null = null;
  private closeCb: (() => void) | null = null;

  connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = TcpSocket.createConnection({ host, port }, () => resolve());
      this.socket.on('data', (chunk: string | Uint8Array) => {
        if (this.dataCb) this.dataCb(Buffer.from(chunk as any));
      });
      this.socket.on('close', () => {
        if (this.closeCb) this.closeCb();
      });
      this.socket.on('error', () => {
        if (this.closeCb) this.closeCb();
      });
    });
  }

  write(data: Buffer): void {
    if (this.socket) this.socket.write(data);
  }

  onData(cb: (chunk: Buffer) => void): void {
    this.dataCb = cb;
  }

  onClose(cb: () => void): void {
    this.closeCb = cb;
  }

  close(): void {
    if (this.socket) this.socket.destroy();
    this.socket = null;
  }
}
