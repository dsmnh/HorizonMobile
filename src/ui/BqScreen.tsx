/**
 * BQ 覆盖同步屏（契约 1.5.0 §8.4）：一次一个队伍、来源服 → 目标服。
 * 覆盖会改写目标服存档，发起前二次确认并显示来源/目标；覆盖前由目标节点自动备份，
 * 失败不自动重试，需人工重新发起。
 */
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from './theme';
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
    <View style={styles.card}>
      <Text style={styles.title}>BQ 覆盖同步</Text>
      <Text style={styles.warning}>
        覆盖会改写目标服的 BetterQuesting 队伍进度，属不可撤销操作。
      </Text>

      <Text style={styles.label}>队伍 ID</Text>
      <TextInput style={styles.input} value={teamId} onChangeText={setTeamId}
        keyboardType="number-pad" placeholder="中央队伍 ID" placeholderTextColor={colors.faint} editable={!busy} />

      <Text style={styles.label}>来源节点 ID</Text>
      <TextInput style={styles.input} value={source} onChangeText={setSource}
        keyboardType="number-pad" placeholder="从这里读取进度" placeholderTextColor={colors.faint} editable={!busy} />

      <Text style={styles.label}>目标节点 ID</Text>
      <TextInput style={styles.input} value={target} onChangeText={setTarget}
        keyboardType="number-pad" placeholder="覆盖到这里" placeholderTextColor={colors.faint} editable={!busy} />

      <Pressable style={[styles.btn, busy && styles.disabled]} disabled={busy} onPress={confirm}>
        <Text style={styles.btnText}>同步（需二次确认）</Text>
      </Pressable>
      {msg !== '' && <Text style={styles.msg}>{msg}</Text>}
      <Text style={styles.note}>
        需要服主或超管账号；节点离线时操作入队，节点上线后执行。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  warning: { color: colors.warn, fontSize: 12, marginTop: 8, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 12, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  btn: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  msg: { color: colors.muted, fontSize: 12, marginTop: 8 },
  note: { color: colors.faint, fontSize: 11, marginTop: 12, lineHeight: 17 },
});
