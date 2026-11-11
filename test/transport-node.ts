/**
 * 传输适配器（e2e/mock 环境）：明文用 node:net，TLS 用 node:tls 并固定证书指纹。
 * 与 RN 传输保持同一 pinning 语义（契约 §9.1）。
 */
import net from 'node:net';
import tls from 'node:tls';
import type { Transport, TlsOptions } from '../src/net/conn';
import { fingerprintMatches } from '../src/net/tls-pin';

export class NodeTransport implements Transport {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private generation = 0;
  private dataCb: ((chunk: Buffer) => void) | null = null;
  private closeCb: (() => void) | null = null;

  connect(host: string, port: number, tlsOpts?: TlsOptions): Promise<void> {
    this.generation += 1;
    const gen = this.generation;
    const useTls = !!tlsOpts?.enabled;
    const socket: net.Socket | tls.TLSSocket = useTls
      ? tls.connect({ host, port, rejectUnauthorized: false })
      : net.connect({ host, port });
    this.socket = socket;
    return new Promise((resolve, reject) => {
      const onReady = () => {
        if (useTls) {
          const cert = (socket as tls.TLSSocket).getPeerCertificate();
          if (!fingerprintMatches(cert?.fingerprint256, tlsOpts?.certFingerprint)) {
            socket.destroy();
            if (gen === this.generation) reject(pinMismatch());
            return;
          }
        }
        resolve();
      };
      if (useTls) socket.once('secureConnect', onReady);
      else socket.once('connect', onReady);
      socket.once('error', (e: Error) => {
        if (gen === this.generation) reject(e);
      });
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
    if (this.socket) this.socket.write(data);
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

/** 指纹不匹配为终止性错误：不进入自动重连。 */
function pinMismatch(): Error & { terminal: boolean } {
  const e = new Error('CERT_FINGERPRINT_MISMATCH') as Error & { terminal: boolean };
  e.terminal = true;
  return e;
}
