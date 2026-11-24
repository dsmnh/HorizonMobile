/** 协议帧编解码与签名单元测试（无网络依赖，纯逻辑验证）。 */
import { strict as assert } from 'node:assert';
import { encodeFrame, T, readFrame, MAX_FRAME_BYTES, FLAG_TLS_BOUND } from '../src/net/protocol';
import { sign, kidOf } from '../src/net/auth';
import { normalizeIdentities } from '../src/net/identity';
import { summarizeNodes } from '../src/net/dashboard';
import { fromEvent, fromHistory, isRelevant, mergeHistory } from '../src/net/chat-merge';
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

/**
 * RN/Hermes 下 Buffer 由 buffer 垫片提供，其 subarray 返回裸 Uint8Array（没有 toString(encoding)）。
 * 帧解析必须走 slice，否则载荷会退化成逗号分隔数字、JSON 解析成空对象。此处用垫片实例复现该约束。
 */
function testFramePolyfillPayloadDecode() {
  const PolyBuffer = require('buffer').Buffer;
  const payload = PolyBuffer.from('{"ok":true}', 'utf8');
  const frame = PolyBuffer.alloc(4 + 2 + payload.length);
  frame.writeUInt32BE(payload.length + 2, 0);
  frame[4] = T.RES;
  frame[5] = FLAG_TLS_BOUND;
  payload.copy(frame, 6);

  let pos = 0;
  const decoded = readFrame((n: number) => {
    const out = frame.slice(pos, pos + n);
    pos += n;
    return out;
  });
  assert.ok(decoded, 'decoded not null');
  assert.equal(decoded!.type, T.RES, 'type');
  assert.equal(decoded!.flags, FLAG_TLS_BOUND, 'flags');
  assert.equal(decoded!.payload.toString('utf8'), '{"ok":true}', '垫片 Buffer 上载荷仍能按 utf8 解出');
  console.log('PASS  polyfill payload decode');
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
  testFramePolyfillPayloadDecode();
  testSignatureConsistency();
  testKidOf();
  testTofuDecision();
  assert.deepEqual(normalizeIdentities(['old', { uuid: 'new', name: ' 玩家 ' }, { name: '无效' }]), [
    { uuid: 'old' }, { uuid: 'new', name: '玩家' },
  ]);
  console.log('PASS  dashboard identity preserves reported player names');
  const nodes = [{ frame: { players: 0, tps: 20 } }, { offline: true, frame: { players: 15, tps: 5 } }, {}];
  assert.deepEqual(summarizeNodes(nodes), { online: 1, total: 3, players: 0, minTps: 20 });
  assert.deepEqual(summarizeNodes([{}]), { online: 0, total: 1, players: null, minTps: null });
  console.log('PASS  dashboard excludes offline and unavailable metrics');
  assert.equal(isRelevant({ private: true, from: 'self', to: 'other' }, 'private', 'peer', 'self'), false);
  assert.equal(isRelevant({ private: true, from: 'peer', to: 'self' }, 'private', 'peer', 'self'), true);
  assert.equal(isRelevant({ private: true, from: 'self', to: 'peer' }, 'private', 'peer', 'self'), true);
  assert.equal(isRelevant({ private: true, from: 'peer' }, 'private', 'peer', 'self'), true);
  const live = fromEvent({ seq: 19, from: 'peer', text: '文本', srv: '节点一', team: '小队', ts: 100 }, 1);
  const history = fromHistory({ id: 32, from: 'peer', text: '文本', srv: '节点一', ts: 100 });
  const otherNode = fromHistory({ id: 33, from: 'peer', text: '文本', srv: '节点二', ts: 100 });
  const combined = mergeHistory([history, otherNode], [live]);
  assert.equal(combined.length, 2);
  assert.equal(combined.find((message) => message.mid === 32)?.team, '小队');
  assert.equal(combined.find((message) => message.mid === 33)?.team, undefined);
  console.log('PASS  private chat peer isolation');
  console.log('== protocol unit tests: all passed ==');
}

runAll();
