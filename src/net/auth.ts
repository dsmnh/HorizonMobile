/**
 * 握手签名（契约 §4.1）：规范串 HORIZON/ts/nonce，HMAC-SHA256，base64url 无填充。
 * 用 @noble/hashes（纯 JS），node 与 RN 环境行为一致。
 */
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes } from '@noble/hashes/utils';

export const CLOCK_SKEW_SEC = 600;

export function sign(token: string, ts: number, nonce: string): string {
  const canonical = `HORIZON\n${ts}\n${nonce}`;
  const mac = hmac(sha256, utf8ToBytes(token), utf8ToBytes(canonical));
  return base64UrlNoPad(mac);
}

/** token 的 kid：前 8 个字符。 */
export function kidOf(token: string): string {
  return token.substring(0, Math.min(8, token.length));
}

export function base64UrlNoPad(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomSid(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return base64UrlNoPad(bytes);
}
