/** node:net 传输适配器：e2e/mock 环境用；RN 运行时替换为 react-native-tcp-socket 适配器。 */
import net from 'node:net';

export class NodeTransport {
  private socket: net.Socket | null = null;
  private generation = 0;
  private dataCb: ((chunk: Buffer) => void) | null = null;
  private closeCb: (() => void) | null = null;

  connect(host: string, port: number): Promise<void> {
    this.generation += 1;
    const gen = this.generation;
    const socket = net.connect({ host, port });
    this.socket = socket;
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('error', (e: Error) => { if (gen === this.generation) reject(e); });
      socket.on('data', (chunk: Buffer) => {
        if (gen !== this.generation || this.socket !== socket) return;
        if (this.dataCb) this.dataCb(chunk);
      });
      socket.on('close', () => {
        if (gen !== this.generation || this.socket !== socket) return;
        if (this.closeCb) this.closeCb();
      });
      socket.on('error', () => {
        if (gen !== this.generation || this.socket !== socket) return;
      });
    });
  }

  write(data: Buffer): void {
    if (this.socket) {
      this.socket.write(data);
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
