/**
 * TLS 证书指纹固定（契约 §9.1）：首次连接信任（TOFU）。
 * 首次连接记录服务端证书指纹并持久化，后续连接必须一致；扫码或手动导入作为可选预置。
 */

/** 剔除冒号、空白等非十六进制字符并转为小写，便于与配置值比较。 */
export function normalizeFingerprint(value: string): string {
  return value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
}

/** 两端均为 64 位十六进制且完全一致时返回 true；格式不合法或缺省一律判为不匹配。 */
export function fingerprintMatches(actual: string, expected?: string): boolean {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  const a = normalizeFingerprint(actual);
  const b = normalizeFingerprint(expected);
  return /^[0-9a-f]{64}$/.test(a) && a === b;
}

/** 指纹存储键按「主机:端口」隔离，同一后端的不同端口互不影响。 */
export function pinKey(host: string, port: number): string {
  return `horizon.tls.pin.${host.toLowerCase()}:${port}`;
}

export type PinDecision = 'match' | 'record' | 'mismatch';

/**
 * TOFU 判定：
 * - 有预置指纹（扫码/手动）时只比对，不覆盖已有记录；
 * - 无预置时读取已记录指纹：无记录判为 record（首次信任），有记录则比对；
 * - 实际指纹格式非法一律 mismatch，存储失败由调用方按拒绝处理。
 */
export function decidePin(stored: string | undefined, actual: string, preset?: string): PinDecision {
  const normalizedActual = normalizeFingerprint(actual);
  if (!/^[0-9a-f]{64}$/.test(normalizedActual)) return 'mismatch';
  const expected = preset != null && preset.trim() !== '' ? preset : stored;
  if (expected == null || normalizeFingerprint(expected) === '') return 'record';
  return normalizeFingerprint(expected) === normalizedActual ? 'match' : 'mismatch';
}

/** 指纹持久化接口：RN 用 AsyncStorage，测试用内存实现。 */
export interface PinStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
