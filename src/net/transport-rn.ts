/**
 * react-native-tcp-socket 传输适配器（RN 运行时；测试环境用 test/transport-node.ts）。
 * 明文用 createConnection；TLS 用 connectTLS 并固定证书 SHA-256 指纹（契约 §9.1）。
 * RN 环境无 Buffer polyfill 时需引入 buffer 包（AEMobileApp 底座已含 buffer 依赖）。
 */
import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import type { Transport, TlsOptions } from './conn';
import { fingerprintMatches } from './tls-pin';

/** 证书字段在 TLS 会话就绪后才可用；secureConnect 可能早于会话，做有限次重试。 */
const PIN_RETRIES = 20;
const PIN_RETRY_MS = 50;

export class RnTransport implements Transport {
  private socket: any = null;
  private dataCb: ((chunk: Buffer) => void) | null = null;
  private closeCb: (() => void) | null = null;

  connect(host: string, port: number, tls?: TlsOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (tls?.enabled) {
        // tlsCheckValidity 关闭系统信任链校验：自签证书改由指纹固定判定。
        const socket = TcpSocket.connectTLS({ host, port, tlsCheckValidity: false }, () => {
          void this.verifyPin(socket, tls.certFingerprint).then(resolve).catch((e) => {
            socket.destroy();
            reject(e);
          });
        });
        this.socket = socket;
        this.attach(socket);
      } else {
        const socket = TcpSocket.createConnection({ host, port }, () => resolve());
        this.socket = socket;
        this.attach(socket);
      }
    });
  }

  private attach(socket: any): void {
    socket.on('data', (chunk: string | Uint8Array) => {
      if (this.dataCb) this.dataCb(Buffer.from(chunk as any));
    });
    socket.on('close', () => {
      if (this.closeCb) this.closeCb();
    });
    socket.on('error', () => {
      if (this.closeCb) this.closeCb();
    });
  }

  private async verifyPin(socket: any, expected?: string): Promise<void> {
    for (let i = 0; i < PIN_RETRIES; i += 1) {
      try {
        const cert = await socket.getPeerCertificate();
        if (fingerprintMatches(cert?.fingerprint256, expected)) return;
      } catch {
        // 会话尚未就绪：下一轮重试
      }
      await sleep(PIN_RETRY_MS);
    }
    throw pinMismatch();
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

/** 指纹不匹配为终止性错误：不进入自动重连。 */
function pinMismatch(): Error & { terminal: boolean } {
  const e = new Error('CERT_FINGERPRINT_MISMATCH') as Error & { terminal: boolean };
  e.terminal = true;
  return e;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
