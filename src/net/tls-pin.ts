/**
 * TLS 证书指纹固定（契约 §9.1）：SHA-256 指纹规范化与比较。
 * RN 与 node 传输共用，确保两端对同一指纹得出一致判定。
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
