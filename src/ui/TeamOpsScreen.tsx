/**
 * 队伍操作屏（迁移适配指南 §TeamScreen 操作子集）：常用队伍域 REQ 动作。
 * 覆盖 create/info/leave/disband/setJoinMode；邀请、申请、审批与角色/转让等
 * 需要目标输入的动作在成员与审批屏（TeamRosterScreen）完成，全 15 个队伍 op 已覆盖。
 * 视觉对齐 AEMobileApp：分组卡 + 危险动作独立分组。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from './theme';
import { Card, Chip, GhostButton, PrimaryButton, SectionLabel, StyledInput } from './components';
import { HorizonConn, type Res } from '../net/conn';
import { officialErrorText } from '../net/official';

export interface TeamOpsScreenProps {
  conn: HorizonConn;
  uuid: string;
  onChanged?: () => void;
}

export function TeamOpsScreen({ conn, uuid, onChanged }: TeamOpsScreenProps): JSX.Element {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const run = async (op: string, p: Record<string, unknown>, doneText: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const res: Res = await conn.req(op, { uuid, ...p });
      if (res.ok) {
        setOkMsg(doneText);
        if (mounted.current) onChanged?.();
      } else {
        // 1.6.5：官方队伍模式下中央写入被拒（OFFICIAL_TEAM_MODE）与映射冲突换成可操作文案
        const friendly = officialErrorText(res.m ?? '');
        setError(`${op}: ${friendly ?? res.m ?? '失败'}`);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>队伍操作</Text>
          <Text style={styles.sub}>创建、退出、解散与加入方式</Text>
        </View>
        <Chip label="team.*" tone="accent2" />
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

      <SectionLabel text="创建队伍" right={<Chip label="team.create" tone="accent2" />} />
      <Card>
        <StyledInput value={name} onChangeText={setName} placeholder="新队伍名" editable={!busy} />
        <View style={{ marginTop: spacing.s }}>
          <PrimaryButton label="创建" icon="add-circle-outline" loading={busy}
            disabled={busy || name.trim() === ''}
            onPress={() => void run('team.create', { name: name.trim() }, '已创建')} />
        </View>
      </Card>

      <SectionLabel text="队伍状态" right={<Chip label="team.info" tone="accent2" />} />
      <Card>
        <Text style={styles.hint}>详情展示在队伍列表与成员页。</Text>
        <View style={styles.actRow}>
          <GhostButton label="查询详情" icon="information-circle-outline" tone="neutral" disabled={busy}
            onPress={() => void run('team.info', {}, '详情已显示于列表')} />
        </View>
      </Card>

      <SectionLabel text="加入方式" right={<Chip label="team.setJoinMode" tone="accent2" />} />
      <Card>
        <View style={styles.actRow}>
          <GhostButton label="公开" icon="globe-outline" tone="accent" disabled={busy}
            onPress={() => void run('team.setJoinMode', { mode: 'open' }, '已切换公开')} />
          <GhostButton label="邀请制" icon="mail-outline" tone="neutral" disabled={busy}
            onPress={() => void run('team.setJoinMode', { mode: 'invite' }, '已切换邀请制')} />
        </View>
      </Card>

      <SectionLabel text="退出与解散" right={<Chip label="不可撤销" tone="bad" />} />
      <Card>
        <Text style={styles.hint}>解散会删除中央队伍并向各节点下发清除；队长不可直接退出。</Text>
        <View style={styles.actRow}>
          <GhostButton label="退出队伍" icon="exit-outline" tone="neutral" disabled={busy}
            onPress={() => Alert.alert('退出队伍', '确认退出当前队伍？', [{ text: '取消', style: 'cancel' }, { text: '退出', style: 'destructive', onPress: () => void run('team.leave', {}, '已退出') }])} />
          <GhostButton label="解散队伍" icon="trash-outline" tone="bad" disabled={busy}
            onPress={() => Alert.alert('解散队伍', '确认解散当前队伍？此操作不可撤销。', [{ text: '取消', style: 'cancel' }, { text: '解散', style: 'destructive', onPress: () => void run('team.disband', {}, '已解散') }])} />
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
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 18 },
  actRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
}));
