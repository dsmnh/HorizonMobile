/**
 * react-native-tcp-socket 传输适配器（RN 运行时；测试环境用 test/transport-node.ts）。
 * 明文用 createConnection；TLS 用 connectTLS 并按 TOFU 固定证书 SHA-256 指纹（契约 §9.1）：
 * 首次连接记录指纹，后续不一致即断开且不重连；设置页可重置已信任指纹。
 * RN 环境无 Buffer polyfill 时需引入 buffer 包（AEMobileApp 底座已含 buffer 依赖）。
 */
import TcpSocket from 'react-native-tcp-socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import type { Transport, TlsOptions } from './conn';
import { decidePin, normalizeFingerprint, pinKey, type PinStore } from './tls-pin';

/** 证书字段在 TLS 会话就绪后才可用；secureConnect 可能早于会话，做有限次重试。 */
const CONNECT_TIMEOUT_MS = 15_000;
const PIN_RETRIES = 20;
const PIN_RETRY_MS = 50;

const pinStore: PinStore = {
  async get(key) {
    return (await AsyncStorage.getItem(key)) ?? undefined;
  },
  async set(key, value) {
    await AsyncStorage.setItem(key, value);
  },
  async remove(key) {
    await AsyncStorage.removeItem(key);
  },
};

/** 重置指定后端的已信任指纹；下次连接重新按 TOFU 记录。 */
export async function resetTrustedPin(host: string, port: number): Promise<void> {
  await pinStore.remove(pinKey(host, port));
}

export class RnTransport implements Transport {
  private socket: any = null;
  private dataCb: ((chunk: Buffer) => void) | null = null;
  private closeCb: (() => void) | null = null;

  connect(host: string, port: number, tls?: TlsOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      // 建连失败必须以 reject 结束：预鉴权在 await connect 之后才装超时定时器，
      // 这里悬挂会让登录按钮永久停留在 busy 状态。
      let settled = false;
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        reject(e);
      };
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(() => fail(new Error(`连接超时：${host}:${port}`)), CONNECT_TIMEOUT_MS);
      const clear = () => clearTimeout(timer);

      if (tls?.enabled) {
        // android 侧只认 rejectUnauthorized=false 才跳过系统信任链；自签证书的真伪由下方指纹固定判定。
        // 类型声明未列 rejectUnauthorized，但 android 原生侧按此键决定是否跳过系统信任链。
        const socket = TcpSocket.connectTLS({ host, port, rejectUnauthorized: false } as any, () => {
          void this.verifyPin(socket, host, port, tls.certFingerprint)
            .then(() => {
              clear();
              done();
            })
            .catch((e) => {
              clear();
              socket.destroy();
              fail(e);
            });
        });
        socket.on('error', (e: Error) => {
          clear();
          fail(e);
        });
        socket.on('close', () => {
          clear();
          fail(new Error('连接已关闭'));
        });
        this.socket = socket;
        this.attach(socket);
      } else {
        const socket = TcpSocket.createConnection({ host, port }, () => {
          clear();
          done();
        });
        socket.on('error', (e: Error) => {
          clear();
          fail(e);
        });
        socket.on('close', () => {
          clear();
          fail(new Error('连接已关闭'));
        });
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

  private async verifyPin(socket: any, host: string, port: number, preset?: string): Promise<void> {
    const actual = await readFingerprint(socket);
    if (actual == null) {
      throw pinMismatch();
    }
    const key = pinKey(host, port);
    const stored = await pinStore.get(key).catch(() => undefined);
    const decision = decidePin(stored, actual, preset);
    if (decision === 'mismatch') {
      throw pinMismatch();
    }
    if (decision === 'record') {
      try {
        await pinStore.set(key, normalizeFingerprint(actual));
      } catch {
        // 无法持久化则拒绝连接，避免每次连接都重新信任
        throw pinStoreFailure();
      }
    }
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

/** 会话就绪前 getPeerCertificate 可能返回空；有限次重试后仍无证书按不匹配处理。 */
async function readFingerprint(socket: any): Promise<string | undefined> {
  for (let i = 0; i < PIN_RETRIES; i += 1) {
    try {
      const cert = await socket.getPeerCertificate();
      if (cert?.fingerprint256) return cert.fingerprint256;
    } catch {
      // 会话尚未就绪：下一轮重试
    }
    await sleep(PIN_RETRY_MS);
  }
  return undefined;
}

/** 指纹不匹配为终止性错误：不进入自动重连。 */
function pinMismatch(): Error & { terminal: boolean } {
  const e = new Error('CERT_FINGERPRINT_MISMATCH') as Error & { terminal: boolean };
  e.terminal = true;
  return e;
}

function pinStoreFailure(): Error & { terminal: boolean } {
  const e = new Error('PIN_STORE_FAILED') as Error & { terminal: boolean };
  e.terminal = true;
  return e;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
