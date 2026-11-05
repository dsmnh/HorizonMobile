/** node:net 传输适配器：e2e/mock 环境用；RN 运行时替换为 react-native-tcp-socket 适配器。 */
import net from 'node:net';

export class NodeTransport {
  private socket: net.Socket | null = null;
  private generation = 0;
  private dataCb: ((chunk: Buffer) => void) | null = null;
  private closeCb: (() => void) | null = null;

  connect(host: string, port: number): Promise<void> {
    const gen = this.generation;
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host, port }, () => resolve());
      this.socket = socket;
      socket.on('data', (chunk: Buffer) => {
        if (gen !== this.generation) return;
        if (this.dataCb) this.dataCb(chunk);
      });
      socket.on('close', () => {
        if (gen !== this.generation) return;
        if (this.closeCb) this.closeCb();
      });
      socket.on('error', () => {
        if (gen !== this.generation) return;
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
    this.generation += 1;
    if (this.socket) this.socket.destroy();
    this.socket = null;
  }
}
