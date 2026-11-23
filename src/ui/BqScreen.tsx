/**
 * BQ 覆盖同步屏（契约 1.5.0 §8.4）：一次一个队伍、来源服 → 目标服。
 * 覆盖会改写目标服存档，发起前二次确认并显示来源/目标；覆盖前由目标节点自动备份，
 * 失败不自动重试，需人工重新发起。
 * 视觉对齐 AEMobileApp：警告条 + 表单卡 + 危险动作按钮。
 */
import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from './theme';
import { Card, Chip, FieldLabel, PrimaryButton, SectionLabel, StyledInput } from './components';
import { HorizonConn, type Res } from '../net/conn';

export interface BqScreenProps {
  conn: HorizonConn;
}

export function BqScreen({ conn }: BqScreenProps): JSX.Element {
  const [teamId, setTeamId] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const start = async (t: number, s: number, d: number) => {
    setBusy(true);
    setMsg('');
    try {
      const res: Res = await conn.req('bq.sync.start', { teamId: t, sourceNode: s, targetNode: d });
      setMsg(res.ok
        ? `已排队，批次 ${res.b?.batchId ?? ''}；覆盖结果以节点回报为准`
        : `bq.sync.start: ${res.m ?? '失败'}`);
    } catch (e: any) {
      setMsg(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (busy) return;
    const t = Number(teamId);
    const s = Number(source);
    const d = Number(target);
    if (!Number.isInteger(t) || !Number.isInteger(s) || !Number.isInteger(d) || t <= 0 || s <= 0 || d <= 0) {
      setMsg('队伍与节点 ID 必须是正整数');
      return;
    }
    Alert.alert(
      '确认覆盖 BQ 进度',
      `将把节点 ${s} 的队伍 ${t} 覆盖到节点 ${d}。\n`
        + '覆盖会改写目标服存档，覆盖前自动备份；失败不会自动重试，需要人工重新发起。',
      [
        { text: '取消', style: 'cancel' },
        { text: '确认覆盖', style: 'destructive', onPress: () => void start(t, s, d) },
      ],
    );
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>BQ 覆盖同步</Text>
          <Text style={styles.sub}>BetterQuesting 队伍进度跨服覆盖</Text>
        </View>
        <Chip label="不可撤销" tone="bad" />
      </View>

      <View style={[styles.warnBox, { backgroundColor: colors.warnSoft, borderColor: colors.warn + '66' }]}>
        <Text style={[styles.warnText, { color: colors.warn }]}>
          覆盖会改写目标服的 BetterQuesting 队伍进度，覆盖前由目标节点自动备份。
        </Text>
      </View>

      <SectionLabel text="同步参数" right={<Chip label="bq.sync.start" tone="accent2" />} />
      <Card>
        <FieldLabel text="队伍 ID" />
        <StyledInput value={teamId} onChangeText={setTeamId} keyboardType="number-pad"
          placeholder="中央队伍 ID" editable={!busy} />

        <FieldLabel text="来源节点 ID" />
        <StyledInput value={source} onChangeText={setSource} keyboardType="number-pad"
          placeholder="从这里读取进度" editable={!busy} />

        <FieldLabel text="目标节点 ID" />
        <StyledInput value={target} onChangeText={setTarget} keyboardType="number-pad"
          placeholder="覆盖到这里" editable={!busy} />

        <View style={{ marginTop: spacing.l }}>
          <PrimaryButton label="同步（需二次确认）" icon="swap-horizontal" tone="bad"
            loading={busy} disabled={busy} onPress={confirm} />
        </View>
      </Card>

      {msg !== '' && (
        <View style={[styles.msgBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={styles.msgText}>{msg}</Text>
        </View>
      )}

      <Text style={styles.note}>
        需要服主或超管账号；节点离线时操作入队，节点上线后执行。
      </Text>
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  warnBox: { marginTop: spacing.m, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  warnText: { fontSize: 12, lineHeight: 18 },
  msgBox: { marginTop: spacing.m, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  msgText: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  note: { color: colors.textFaint, fontSize: 11, marginTop: spacing.m, lineHeight: 17 },
}));
