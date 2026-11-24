/** 协议帧编解码与签名单元测试（无网络依赖，纯逻辑验证）。 */
import { strict as assert } from 'node:assert';
import { encodeFrame, T, readFrame, MAX_FRAME_BYTES, FLAG_TLS_BOUND } from '../src/net/protocol';
import { sign, kidOf } from '../src/net/auth';
import { normalizeIdentities } from '../src/net/identity';
import { summarizeNodes } from '../src/net/dashboard';
import { fromEvent, fromHistory, isRelevant, mergeHistory } from '../src/net/chat-merge';
import {
  canInvite, currentOfficialTeam, needConfirmText, normalizeCandidates, normalizeLinks,
  normalizeTeams, officialErrorText, officialKey, officialState, parseNeedConfirm, reasonLabel,
  rolesOf, slotKey, stateLabel, teamsOfPlayer, worldCount,
} from '../src/net/official';
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

/** 契约 1.6.5 §8.8：官方队伍投影归一化、状态判定与只读语义的用户文案。 */
function testOfficialProjection() {
  const links = normalizeLinks([
    { nodeId: 5, worldRef: 'w:world:1a2b', officialTeamId: 't-1', gen: 3, updatedAt: 100, stale: false },
    { nodeId: -1, worldRef: 'w:world:1a2b', officialTeamId: 't-x' },
    { nodeId: 6, worldRef: '', officialTeamId: 't-y' },
    { nodeId: 7, worldRef: 'w:world:1a2b' },
    null,
  ]);
  assert.equal(links.length, 1, '缺 nodeId/worldRef/officialTeamId 的绑定应整体丢弃');
  assert.equal(links[0].officialTeamId, 't-1');
  assert.equal(slotKey(5, 'w:world:1a2b'), '5/w:world:1a2b');
  assert.equal(officialKey(5, 'w:world:1a2b', 't-1'), '5/w:world:1a2b/t-1');

  const teams = normalizeTeams([
    { nodeId: 5, worldRef: 'w:world:1a2b', officialTeamId: 't-1', gen: 3, seq: 9, ready: true,
      stale: false, name: '挖矿队', owners: ['a', ''], officers: ['b'], members: ['a', 'b', 'c'] },
    { nodeId: 5, worldRef: 'w:world:1a2b', officialTeamId: 't-2', gen: 3, seq: 9, ready: false,
      stale: true, name: '', owners: [], officers: [], members: [] },
    'bad',
  ]);
  assert.equal(teams.length, 2, '非对象元素应丢弃');
  assert.deepEqual(teams[0].owners, ['a'], '空串 UUID 不应进入名单');
  assert.deepEqual(rolesOf(teams[0], 'a'), ['owner', 'member'], '同一 UUID 可同时是 owner 与 member');
  assert.deepEqual(rolesOf(teams[0], 'c'), ['member']);
  assert.deepEqual(rolesOf(teams[0], 'z'), [], '非成员没有角色');
  assert.equal(officialState(teams[0]), 'ok');
  assert.equal(stateLabel(officialState(teams[0])), '已同步');
  assert.equal(officialState(teams[1]), 'missing', '名字为空说明映射指向的官方队伍已消失');
  assert.equal(stateLabel(officialState({ ...teams[0], ready: false })), '投影已过期');
  assert.equal(officialState({ ...teams[0], stale: true }), 'stale');
  assert.equal(worldCount(teams), 1, '两支队伍在同一世界只算一个世界');
  assert.equal(teamsOfPlayer(teams, 'b').length, 1);
  assert.equal(teamsOfPlayer(teams, '').length, 0, '未绑定身份不返回任何官方队伍');

  const candidates = normalizeCandidates([
    { nodeId: 5, worldRef: 'w:world:1a2b', officialTeamId: 't-1', name: '挖矿队', reason: 'uuid-overlap' },
    { nodeId: 5, worldRef: 'w:world:1a2b', officialTeamId: 't-3', name: '同名队', reason: 'name-similar' },
    { nodeId: 5, name: '缺字段' },
  ]);
  assert.equal(candidates.length, 2);
  assert.equal(reasonLabel(candidates[0].reason), '成员重合');
  assert.equal(reasonLabel(candidates[1].reason), '同名');
  assert.equal(reasonLabel(''), '候选', '空理由有兜底文案');
  assert.equal(reasonLabel('自定义'), '自定义', '未知理由原样展示便于排错');

  assert.ok((officialErrorText('OFFICIAL_TEAM_MODE') ?? '').includes('只读投影'));
  assert.ok((officialErrorText('MAP_CONFLICT') ?? '').includes('映射'));
  assert.equal(officialErrorText('FORBIDDEN'), null, '非官方队伍错误码不由本层改写');

  // 1.6.5 聊天：队伍来源随实时事件进入消息，历史合并时优先保留实时标签
  const live = fromEvent({ seq: 21, from: 'peer', text: '文本', srv: '节点一', team: '官方队', teamSource: 'official', ts: 100 }, 1);
  assert.equal(live.teamSource, 'official');
  assert.equal(fromEvent({ seq: 22, from: 'peer', text: 'x', teamSource: 'unknown' }, 2).teamSource, undefined, '未知来源丢弃');
  const merged = mergeHistory([fromHistory({ id: 40, from: 'peer', text: '文本', srv: '节点一', ts: 100 })], [live]);
  assert.equal(merged.find((message) => message.mid === 40)?.teamSource, 'official', '实时来源标签合并进历史消息');
  console.log('PASS  official team projection (contract 1.6.5)');

  // 1.6.6 受控写入：只开放邀请与接受，合队必须先确认
  assert.equal(officialErrorText('PROJECTION_STALE')?.includes('投影已过期'), true);
  assert.equal(canInvite(teams[0], 'a'), true, '队长可邀请');
  assert.equal(canInvite(teams[0], 'b'), true, '副队长可邀请');
  assert.equal(canInvite(teams[0], 'c'), false, '普通成员不可邀请');
  assert.equal(currentOfficialTeam(teams, 'c')?.officialTeamId, 't-1');
  assert.equal(currentOfficialTeam(teams, 'z'), null, '不在任何官方队伍时无原队');
  const confirmInfo = parseNeedConfirm({ consumed: 't-2', surviving: 't-1', memberCount: 1 });
  assert.ok(confirmInfo);
  assert.equal(confirmInfo?.consumed, 't-2');
  assert.equal(parseNeedConfirm({ consumed: 't-2' }), null, '字段不全不展示半截提示');
  assert.equal(parseNeedConfirm(null), null);
  assert.ok(needConfirmText(confirmInfo!).includes('t-2'), '确认文案点名被并入的队伍');
  assert.ok(needConfirmText(confirmInfo!).includes('不可撤销'));
  console.log('PASS  official team controlled writes (contract 1.6.6)');
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
  testOfficialProjection();
  console.log('== protocol unit tests: all passed ==');
}

runAll();
