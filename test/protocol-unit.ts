/** 协议帧编解码与签名单元测试（无网络依赖，纯逻辑验证）。 */
import { strict as assert } from 'node:assert';
import { encodeFrame, T, readFrame, MAX_FRAME_BYTES } from '../src/net/protocol';
import { sign, kidOf } from '../src/net/auth';

function reader(data: Buffer) {
  let pos = 0;
  return {
    readExact(n: number): Buffer {
      if (pos + n > data.length) {
        const e: any = new Error('EOF');
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
  const frame = encodeFrame(T.REQ, payload);
  assert.equal(frame.length, 4 + 2 + payload.length, 'frame length');

  const { readExact } = reader(frame);
  const decoded = readFrame(readExact);
  assert.ok(decoded, 'decoded not null');
  assert.equal(decoded!.type, T.REQ, 'type');
  assert.equal(decoded!.flags, 0, 'flags');
  assert.deepEqual(decoded!.payload, payload, 'payload');
  console.log('PASS  frame roundtrip');
}

function testFrameEmptyPayload() {
  const frame = encodeFrame(T.PING);
  assert.equal(frame.length, 6, 'empty frame = 4 header + 2 prefix');
  const { readExact } = reader(frame);
  const decoded = readFrame(readExact);
  assert.ok(decoded);
  assert.equal(decoded!.type, T.PING);
  assert.equal(decoded!.payload.length, 0, 'empty payload');
  console.log('PASS  empty payload frame');
}

function testFrameTooShort() {
  const bad = Buffer.alloc(4);
  bad.writeUInt32BE(1, 0); // len < 2
  const { readExact } = reader(bad);
  assert.throws(() => readFrame(readExact), 'len<2 should throw');
  console.log('PASS  frame len<2 throws');
}

function testFrameMaxSize() {
  const bad = Buffer.alloc(4);
  bad.writeUInt32BE(MAX_FRAME_BYTES + 1, 0);
  const { readExact } = reader(bad);
  assert.throws(() => readFrame(readExact), 'oversize should throw');
  console.log('PASS  oversize frame throws');
}

function testSignatureConsistency() {
  // noble HMAC 与 node:crypto HMAC 一致
  const crypto = require('node:crypto');
  const token = 'tok-test-1234567890';
  const ts = 1793906476;
  const nonce = 'AAAAAAAAAAA';
  const tsSig = sign(token, ts, nonce);
  const nodeSig = crypto.createHmac('sha256', token)
    .update(`HORIZON\n${ts}\n${nonce}`).digest('base64url');
  assert.equal(tsSig, nodeSig, 'noble HMAC = node:crypto HMAC');
  console.log('PASS  noble HMAC = node:crypto HMAC');
}

function testKidOf() {
  assert.equal(kidOf('tok-12345678-rest'), 'tok-1234');
  assert.equal(kidOf('ab'), 'ab');
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
