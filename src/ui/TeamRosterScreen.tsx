/**
 * 队伍成员与审批屏（迁移适配指南 §TeamScreen 补全，契约 1.5.0 §team）：
 * team.info 渲染成员（uuid+role），行内 kick/transfer/setRole；invite（目标 UUID）与
 * acceptInvite/declineInvite（邀请 ID）、apply（队伍 ID）、approveApply/denyApply（申请 ID）。
 * 权限差异由后端裁决（FORBIDDEN 原样展示）；队长独有 disband/transfer（企划书 04 权限口径）。
 * 视觉对齐 AEMobileApp：成员卡 + 角色胶囊 + 分组操作区。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from './theme';
import {
  Card, Chip, EmptyState, GhostButton, PrimaryButton, SectionLabel, StatusDot, StyledInput,
} from './components';
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

function roleLabel(role: string): string {
  return role === 'leader' ? '队长' : role === 'vice' ? '副队长' : '成员';
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
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>成员与审批</Text>
          <Text style={styles.sub}>{teamId != null ? `队伍 ${teamId} · ${members.length} 名成员` : '尚未加入队伍'}</Text>
        </View>
        <GhostButton label="刷新" icon="refresh" tone="neutral" onPress={() => void load()} />
      </View>

      {error !== '' && (
        <View style={[styles.msgBox, { backgroundColor: colors.badSoft, borderColor: colors.bad + '55' }]}>
          <Text style={[styles.msgText, { color: colors.bad }]}>{error}</Text>
        </View>
      )}
      {okMsg !== '' && (
        <View style={[styles.msgBox, { backgroundColor: colors.okSoft, borderColor: colors.ok + '55' }]}>
          <Text style={[styles.msgText, { color: colors.ok }]}>{okMsg}</Text>
        </View>
      )}

      {members.length === 0 && (
        <EmptyState icon="people-circle-outline" title="暂无成员信息" subtitle="加入队伍后在此显示成员与角色" />
      )}

      {members.map((m) => (
        <Card key={m.uuid} style={{ marginTop: spacing.m }}>
          <View style={styles.memberHead}>
            <View style={styles.memberTitleRow}>
              <StatusDot ok={m.uuid === uuid} />
              <Text style={styles.memberUuid} numberOfLines={1}>{m.uuid}</Text>
            </View>
            <Chip label={roleLabel(m.role)} tone={m.role === 'leader' ? 'accent' : m.role === 'vice' ? 'accent2' : 'neutral'} />
          </View>
          <View style={styles.actRow}>
            {m.role !== 'leader' && (
              <>
                <GhostButton label="副队长" tone="neutral" disabled={busy}
                  onPress={() => void run('team.setRole', { target: m.uuid, role: 'vice' }, '已设为副队长')} />
                <GhostButton label="成员" tone="neutral" disabled={busy}
                  onPress={() => void run('team.setRole', { target: m.uuid, role: 'member' }, '已设为成员')} />
              </>
            )}
            {m.uuid !== uuid && (
              <>
                <GhostButton label="移出" icon="person-remove-outline" tone="bad" disabled={busy}
                  onPress={() => void run('team.kick', { target: m.uuid }, '已移出')} />
                {isLeader && (
                  <GhostButton label="转让队长" icon="swap-vertical-outline" tone="accent" disabled={busy}
                    onPress={() => void run('team.transfer', { target: m.uuid }, '已转让队长')} />
                )}
              </>
            )}
          </View>
        </Card>
      ))}

      <SectionLabel text="邀请" right={<Chip label="team.invite" tone="accent2" />} />
      <Card>
        <StyledInput value={inviteTarget} onChangeText={setInviteTarget} placeholder="邀请目标 UUID" editable={!busy} />
        <View style={{ marginTop: spacing.s }}>
          <PrimaryButton label="发出邀请" icon="person-add-outline" loading={busy}
            disabled={busy || inviteTarget.trim() === ''}
            onPress={() => void run('team.invite', { target: inviteTarget.trim() }, '邀请已发出')} />
        </View>
      </Card>

      <SectionLabel text="收到的邀请" right={<Chip label="inviteId" tone="accent2" />} />
      <Card>
        <StyledInput value={inviteId} onChangeText={setInviteId} placeholder="邀请 ID" keyboardType="number-pad" editable={!busy} />
        <View style={[styles.actRow, { marginTop: spacing.s }]}>
          <PrimaryButton label="接受" icon="checkmark" loading={busy} disabled={busy || inviteId.trim() === ''}
            onPress={() => void run('team.acceptInvite', { inviteId: Number(inviteId) }, '已接受邀请')} />
          <GhostButton label="谢绝" tone="bad" disabled={busy || inviteId.trim() === ''}
            onPress={() => void run('team.declineInvite', { inviteId: Number(inviteId) }, '已谢绝')} />
        </View>
      </Card>

      <SectionLabel text="申请加入公开队伍" right={<Chip label="team.apply" tone="accent2" />} />
      <Card>
        <StyledInput value={applyTeamId} onChangeText={setApplyTeamId} placeholder="队伍 ID" keyboardType="number-pad" editable={!busy} />
        <View style={{ marginTop: spacing.s }}>
          <PrimaryButton label="提交申请" icon="paper-plane-outline" loading={busy}
            disabled={busy || applyTeamId.trim() === ''}
            onPress={() => void run('team.apply', { teamId: Number(applyTeamId) }, '申请已提交')} />
        </View>
      </Card>

      <SectionLabel text="审批申请" right={<Chip label="applyId" tone="accent2" />} />
      <Card>
        <StyledInput value={applyId} onChangeText={setApplyId} placeholder="申请 ID" keyboardType="number-pad" editable={!busy} />
        <View style={[styles.actRow, { marginTop: spacing.s }]}>
          <PrimaryButton label="批准" icon="checkmark-done" loading={busy} disabled={busy || applyId.trim() === ''}
            onPress={() => void run('team.approveApply', { applyId: Number(applyId) }, '已批准')} />
          <GhostButton label="拒绝" tone="bad" disabled={busy || applyId.trim() === ''}
            onPress={() => void run('team.denyApply', { applyId: Number(applyId) }, '已拒绝')} />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  msgBox: { marginTop: spacing.m, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  msgText: { fontSize: 12, lineHeight: 17 },
  memberHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flex: 1 },
  memberUuid: { color: colors.text, fontSize: 12, flex: 1 },
  actRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.m },
}));
