/**
 * 队伍成员与审批屏（迁移适配指南 §TeamScreen 补全，契约 1.5.0 §team）：
 * team.info 渲染成员（uuid+role），行内 kick/transfer/setRole；invite（目标 UUID）与
 * acceptInvite/declineInvite（邀请 ID）、apply（队伍 ID）、approveApply/denyApply（申请 ID）。
 * 权限差异由后端裁决（FORBIDDEN 原样展示）；队长独有 disband/transfer（企划书 04 权限口径）。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from './theme';
import { HorizonConn, type Res } from '../net/conn';

interface MemberRow {
  uuid: string;
  role: string;
}

export interface TeamRosterScreenProps {
  conn: HorizonConn;
  uuid: string;
  onChanged?: () => void;
}

export function TeamRosterScreen({ conn, uuid, onChanged }: TeamRosterScreenProps): JSX.Element {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [inviteTarget, setInviteTarget] = useState('');
  const [inviteId, setInviteId] = useState('');
  const [applyTeamId, setApplyTeamId] = useState('');
  const [applyId, setApplyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res: Res = await conn.req('team.info', { uuid });
      if (res.ok && res.b?.team) {
        const team = res.b.team;
        setTeamId(team.teamId ?? null);
        setMembers(Array.isArray(team.members)
          ? team.members.map((m: any) => ({ uuid: String(m.uuid), role: String(m.role) }))
          : []);
      } else if (res.ok) {
        setMembers([]);
        setTeamId(null);
      } else {
        setMembers([]);
        setTeamId(null);
        if (res.m && res.m !== 'NOT_IN_TEAM') setError(res.m);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }, [conn, uuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (op: string, p: Record<string, unknown>, doneText: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const res: Res = await conn.req(op, { uuid, ...p });
      if (res.ok) {
        setOkMsg(doneText);
        onChanged?.();
        await load();
      } else {
        setError(`${op}: ${res.m ?? '失败'}`);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const isLeader = members.some((m) => m.uuid === uuid && m.role === 'leader');

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>成员与审批{teamId != null ? `（队伍 ${teamId}）` : ''}</Text>
        <Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <Text style={styles.refreshText}>刷新</Text>
        </Pressable>
      </View>

      {members.map((m) => (
        <View key={m.uuid} style={styles.memberRow}>
          <View style={styles.memberMeta}>
            <Text style={styles.memberUuid} numberOfLines={1}>{m.uuid}</Text>
            <Text style={styles.memberRole}>
              {m.role === 'leader' ? '队长' : m.role === 'vice' ? '副队长' : '成员'}
            </Text>
          </View>
          <View style={styles.memberActions}>
            {m.role !== 'leader' && (
              <>
                <Pressable style={styles.miniBtn} disabled={busy}
                  onPress={() => void run('team.setRole', { target: m.uuid, role: 'vice' }, '已设为副队长')}>
                  <Text style={styles.miniText}>副</Text>
                </Pressable>
                <Pressable style={styles.miniBtn} disabled={busy}
                  onPress={() => void run('team.setRole', { target: m.uuid, role: 'member' }, '已设为成员')}>
                  <Text style={styles.miniText}>员</Text>
                </Pressable>
              </>
            )}
            {m.uuid !== uuid && (
              <>
                <Pressable style={styles.miniBtn} disabled={busy}
                  onPress={() => void run('team.kick', { target: m.uuid }, '已移出')}>
                  <Text style={styles.miniText}>移出</Text>
                </Pressable>
                {isLeader && (
                  <Pressable style={styles.miniBtn} disabled={busy}
                    onPress={() => void run('team.transfer', { target: m.uuid }, '已转让队长')}>
                    <Text style={styles.miniText}>转让</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      ))}

      <View style={styles.idRow}>
        <TextInput style={styles.input} value={inviteId} onChangeText={setInviteId}
          placeholder="邀请 ID（收到的邀请）" placeholderTextColor="#5A6B8C" editable={!busy} />
        <Pressable style={styles.btn} disabled={busy || !inviteId.trim()}
          onPress={() => void run('team.acceptInvite', { inviteId: Number(inviteId) }, '已接受邀请')}>
          <Text style={styles.btnText}>接受</Text>
        </Pressable>
        <Pressable style={styles.btnSecondary} disabled={busy || !inviteId.trim()}
          onPress={() => void run('team.declineInvite', { inviteId: Number(inviteId) }, '已谢绝')}>
          <Text style={styles.btnSecondaryText}>谢绝</Text>
        </Pressable>
      </View>

      <View style={styles.idRow}>
        <TextInput style={styles.input} value={applyTeamId} onChangeText={setApplyTeamId}
          placeholder="队伍 ID（申请加入公开队伍）" placeholderTextColor="#5A6B8C" editable={!busy} />
        <Pressable style={styles.btn} disabled={busy || !applyTeamId.trim()}
          onPress={() => void run('team.apply', { teamId: Number(applyTeamId) }, '申请已提交')}>
          <Text style={styles.btnText}>申请</Text>
        </Pressable>
      </View>

      <View style={styles.idRow}>
        <TextInput style={styles.input} value={applyId} onChangeText={setApplyId}
          placeholder="申请 ID（审批）" placeholderTextColor="#5A6B8C" editable={!busy} />
        <Pressable style={styles.btn} disabled={busy || !applyId.trim()}
          onPress={() => void run('team.approveApply', { applyId: Number(applyId) }, '已批准')}>
          <Text style={styles.btnText}>批准</Text>
        </Pressable>
        <Pressable style={styles.btnSecondary} disabled={busy || !applyId.trim()}
          onPress={() => void run('team.denyApply', { applyId: Number(applyId) }, '已拒绝')}>
          <Text style={styles.btnSecondaryText}>拒绝</Text>
        </Pressable>
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {okMsg !== '' && <Text style={styles.ok}>{okMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.primary },
  refreshText: { color: colors.primaryText, fontSize: 12 },
  memberRow: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberMeta: { flex: 1, marginRight: 8 },
  memberUuid: { color: colors.text, fontSize: 12 },
  memberRole: { color: colors.muted, fontSize: 11, marginTop: 2 },
  memberActions: { flexDirection: 'row', gap: 6 },
  miniBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  miniText: { color: colors.primaryText, fontSize: 11 },
  idRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
  },
  btn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  btnSecondary: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  btnSecondaryText: { color: colors.primaryText, fontSize: 13 },
  error: { color: colors.danger, fontSize: 12, marginTop: 8 },
  ok: { color: colors.ok, fontSize: 12, marginTop: 8 },
});
