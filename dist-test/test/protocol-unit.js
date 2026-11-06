"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** 协议帧编解码与签名单元测试（无网络依赖，纯逻辑验证）。 */
const node_assert_1 = require("node:assert");
const protocol_1 = require("../src/net/protocol");
const auth_1 = require("../src/net/auth");
function reader(data) {
    let pos = 0;
    return {
        readExact(n) {
            if (pos + n > data.length) {
                const e = new Error('EOF');
                e.eof = true;
                throw e;
            }
            const out = data.subarray(pos, pos + n);
            pos += n;
            return out;
        },
    };
}
function testFrameRoundtrip() {
    const payload = Buffer.from('{"test":1}', 'utf8');
    const frame = (0, protocol_1.encodeFrame)(protocol_1.T.REQ, payload);
    node_assert_1.strict.equal(frame.length, 4 + 2 + payload.length, 'frame length');
    const { readExact } = reader(frame);
    const decoded = (0, protocol_1.readFrame)(readExact);
    node_assert_1.strict.ok(decoded, 'decoded not null');
    node_assert_1.strict.equal(decoded.type, protocol_1.T.REQ, 'type');
    node_assert_1.strict.equal(decoded.flags, 0, 'flags');
    node_assert_1.strict.deepEqual(decoded.payload, payload, 'payload');
    console.log('PASS  frame roundtrip');
}
function testFrameEmptyPayload() {
    const frame = (0, protocol_1.encodeFrame)(protocol_1.T.PING);
    node_assert_1.strict.equal(frame.length, 6, 'empty frame = 4 header + 2 prefix');
    const { readExact } = reader(frame);
    const decoded = (0, protocol_1.readFrame)(readExact);
    node_assert_1.strict.ok(decoded);
    node_assert_1.strict.equal(decoded.type, protocol_1.T.PING);
    node_assert_1.strict.equal(decoded.payload.length, 0, 'empty payload');
    console.log('PASS  empty payload frame');
}
function testFrameTooShort() {
    const bad = Buffer.alloc(4);
    bad.writeUInt32BE(1, 0); // len < 2
    const { readExact } = reader(bad);
    node_assert_1.strict.throws(() => (0, protocol_1.readFrame)(readExact), 'len<2 should throw');
    console.log('PASS  frame len<2 throws');
}
function testFrameMaxSize() {
    const bad = Buffer.alloc(4);
    bad.writeUInt32BE(protocol_1.MAX_FRAME_BYTES + 1, 0);
    const { readExact } = reader(bad);
    node_assert_1.strict.throws(() => (0, protocol_1.readFrame)(readExact), 'oversize should throw');
    console.log('PASS  oversize frame throws');
}
function testSignatureConsistency() {
    // noble HMAC 与 node:crypto HMAC 一致
    const crypto = require('node:crypto');
    const token = 'tok-test-1234567890';
    const ts = 1793906476;
    const nonce = 'AAAAAAAAAAA';
    const tsSig = (0, auth_1.sign)(token, ts, nonce);
    const nodeSig = crypto.createHmac('sha256', token)
        .update(`HORIZON\n${ts}\n${nonce}`).digest('base64url');
    node_assert_1.strict.equal(tsSig, nodeSig, 'noble HMAC = node:crypto HMAC');
    console.log('PASS  noble HMAC = node:crypto HMAC');
}
function testKidOf() {
    node_assert_1.strict.equal((0, auth_1.kidOf)('tok-12345678-rest'), 'tok-1234');
    node_assert_1.strict.equal((0, auth_1.kidOf)('ab'), 'ab');
    console.log('PASS  kidOf');
}
function runAll() {
    testFrameRoundtrip();
    testFrameEmptyPayload();
    testFrameTooShort();
    testFrameMaxSize();
    testSignatureConsistency();
    testKidOf();
    console.log('== protocol unit tests: all passed ==');
}
runAll();
