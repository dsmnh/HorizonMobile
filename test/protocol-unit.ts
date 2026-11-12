/** 协议帧编解码与签名单元测试（无网络依赖，纯逻辑验证）。 */
import { strict as assert } from 'node:assert';
import { encodeFrame, T, readFrame, MAX_FRAME_BYTES, FLAG_TLS_BOUND } from '../src/net/protocol';
import { sign, kidOf } from '../src/net/auth';
import { decidePin, normalizeFingerprint, pinKey } from '../src/net/tls-pin';

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

function testFrameFlags() {
  assert.equal(encodeFrame(T.PING)[5], 0, '未传 flags 时缺省为 0');
  const frame = encodeFrame(T.REQ, Buffer.from('{}', 'utf8'), FLAG_TLS_BOUND);
  assert.equal(frame[5], FLAG_TLS_BOUND, '出帧写入 0x02');
  const { readExact } = reader(frame);
  assert.equal(readFrame(readExact)!.flags, FLAG_TLS_BOUND, '入帧读出 0x02');
  console.log('PASS  flags 0x02 编码与缺省');
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

/** 契约 §9.1：首次连接记录指纹，后续不一致拒绝；预置指纹优先于本地记录。 */
function testTofuDecision() {
  const fp = 'AB'.repeat(32);
  const other = 'CD'.repeat(32);
  assert.equal(decidePin(undefined, fp), 'record', '首次连接应记录');
  assert.equal(decidePin(fp, fp), 'match', '同一指纹应通过');
  assert.equal(decidePin(fp, other), 'mismatch', '指纹变化应拒绝');
  assert.equal(decidePin(undefined, fp, fp), 'match', '预置指纹直接比对');
  assert.equal(decidePin(fp, other, other), 'match', '预置指纹优先于本地记录');
  assert.equal(decidePin(undefined, 'bad'), 'mismatch', '非法指纹一律拒绝');
  assert.equal(normalizeFingerprint('AB:CD'), 'abcd');
  assert.equal(pinKey('Example.COM', 44444), 'horizon.tls.pin.example.com:44444');
  console.log('PASS  TOFU 指纹判定与键格式');
}

function runAll() {
  testFrameRoundtrip();
  testFrameEmptyPayload();
  testFrameFlags();
  testFrameTooShort();
  testFrameMaxSize();
  testSignatureConsistency();
  testKidOf();
  testTofuDecision();
  console.log('== protocol unit tests: all passed ==');
}

runAll();
