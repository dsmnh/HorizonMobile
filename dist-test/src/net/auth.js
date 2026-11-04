"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLOCK_SKEW_SEC = void 0;
exports.sign = sign;
exports.kidOf = kidOf;
exports.base64UrlNoPad = base64UrlNoPad;
exports.randomSid = randomSid;
/**
 * 握手签名（契约 §4.1）：规范串 HORIZON/ts/nonce，HMAC-SHA256，base64url 无填充。
 * 用 @noble/hashes（纯 JS），node 与 RN 环境行为一致。
 */
const hmac_1 = require("@noble/hashes/hmac");
const sha256_1 = require("@noble/hashes/sha256");
const utils_1 = require("@noble/hashes/utils");
exports.CLOCK_SKEW_SEC = 600;
function sign(token, ts, nonce) {
    const canonical = `HORIZON\n${ts}\n${nonce}`;
    const mac = (0, hmac_1.hmac)(sha256_1.sha256, (0, utils_1.utf8ToBytes)(token), (0, utils_1.utf8ToBytes)(canonical));
    return base64UrlNoPad(mac);
}
/** token 的 kid：前 8 个字符。 */
function kidOf(token) {
    return token.substring(0, Math.min(8, token.length));
}
function base64UrlNoPad(bytes) {
    let bin = '';
    for (const b of bytes)
        bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomSid() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return base64UrlNoPad(bytes);
}
