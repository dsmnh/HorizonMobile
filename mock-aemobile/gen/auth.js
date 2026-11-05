"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tcpAuth = exports.signCanonical = exports.kidOf = exports.normalizeToken = exports.base64url = exports.serverNowSec = exports.getClockOffset = exports.setClockOffset = void 0;
// 鉴权签名：token 不上网线，只发 kid + HMAC-SHA256 签名。
//
// 协议 3.0.0（TCP）的流程：
//   1. 客户端发 HELLO，服务端回 HELLO_ACK { time, nonce }
//   2. 客户端用 nonce 签 "AE2TCP\n<ts>\n<nonce>"，发 AUTH { kid, ts, sig }
//   nonce 每条连接一个新值 → 抓到的 AUTH 帧换条连接就失效（天然防重放）
//
// 服务端实现见 AEMobile 仓库 net/AuthTokens.java、net/TcpConnection.java；
// 契约见 doc/传输协议与安全.md §3。
const hmac_1 = require("@noble/hashes/hmac");
const sha256_1 = require("@noble/hashes/sha256");
const utils_1 = require("@noble/hashes/utils");
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** 服务器时间 - 本机时间（秒）。手机时钟偏差会让签名全部失效，所以必须校正。 */
let clockOffsetSec = 0;
function setClockOffset(sec) {
    clockOffsetSec = Number.isFinite(sec) ? Math.round(sec) : 0;
}
exports.setClockOffset = setClockOffset;
function getClockOffset() {
    return clockOffsetSec;
}
exports.getClockOffset = getClockOffset;
/** 校正后的当前时间（秒），签名里的 ts 用它 */
function serverNowSec() {
    return Math.floor(Date.now() / 1000) + clockOffsetSec;
}
exports.serverNowSec = serverNowSec;
/** Uint8Array → base64url（无填充）。RN 的 btoa 不可靠，自己实现。 */
function base64url(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        out += B64URL[b0 >> 2];
        out += B64URL[((b0 & 3) << 4) | (b1 >> 4)];
        if (i + 1 < bytes.length)
            out += B64URL[((b1 & 15) << 2) | (b2 >> 6)];
        if (i + 2 < bytes.length)
            out += B64URL[b2 & 63];
    }
    return out;
}
exports.base64url = base64url;
/** 规范化用户粘贴的 token：去掉空白、转大写（服务端存的是大写） */
function normalizeToken(raw) {
    return (raw || '').replace(/\s+/g, '').toUpperCase();
}
exports.normalizeToken = normalizeToken;
/** token 的前 8 字符，服务端用它定位 token */
function kidOf(token) {
    return normalizeToken(token).slice(0, 8);
}
exports.kidOf = kidOf;
/** 对规范串签名（base64url）。单独导出是为了能和服务端实现做对拍测试。 */
function signCanonical(token, canonical) {
    const key = normalizeToken(token);
    return base64url((0, hmac_1.hmac)(sha256_1.sha256, (0, utils_1.utf8ToBytes)(key), (0, utils_1.utf8ToBytes)(canonical)));
}
exports.signCanonical = signCanonical;
/**
 * 生成 AUTH 帧的字段。
 *
 * 规范串（3 行，与服务端 TcpConnection.onAuth 逐字节一致）：
 *   AE2TCP \n ts \n nonce
 */
function tcpAuth(token, ts, nonce) {
    return {
        kid: kidOf(token),
        sig: signCanonical(token, `AE2TCP\n${ts}\n${nonce}`),
    };
}
exports.tcpAuth = tcpAuth;
