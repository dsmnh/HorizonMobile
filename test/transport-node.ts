/** node:net 传输适配器：e2e/mock 环境用；RN 运行时替换为 react-native-tcp-socket 适配器。 */
import net from 'node:net';

export class NodeTransport {
  private socket: net.Socket | null = null;
  private dataCb: ((chunk: Buffer) => void) | null = null;
  private closeCb: (() => void) | null = null;

  connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.connect({ host, port }, () => resolve());
      this.socket.on('data', (chunk: Buffer) => {
        if (this.dataCb) this.dataCb(chunk);
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
    if (this.socket) {
      console.error('[xport] w' + (data[4] ?? -1).toString(16));
      this.socket.write(data);
    } else {
      console.error('[xport] w-closed');
    }
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
