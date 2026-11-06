/**
 * 队伍操作屏（迁移适配指南 §TeamScreen 操作子集）：常用队伍域 REQ 动作。
 * 覆盖 create/info/leave/disband/joinmode；invite/apply/setrole 等需要目标输入的
 * 动作随下一迁移增量（游戏内命令在 /dsmnhmobile team 子命令全量可用）。
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HorizonConn, type Res } from '../net/conn';

export interface TeamOpsScreenProps {
  conn: HorizonConn;
  uuid: string;
  onChanged?: () => void;
}

export function TeamOpsScreen({ conn, uuid, onChanged }: TeamOpsScreenProps): JSX.Element {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

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
      } else {
        setError(`${op}: ${res.m ?? '失败'}`);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>队伍操作</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="新队伍名"
          placeholderTextColor="#5A6B8C"
          editable={!busy}
        />
        <Pressable style={[styles.btn, busy && styles.disabled]} disabled={busy}
          onPress={() => void run('team.create', { name: name.trim() }, '已创建')}>
          <Text style={styles.btnText}>创建</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable style={[styles.btn2, busy && styles.disabled]} disabled={busy}
          onPress={() => void run('team.info', {}, '详情已显示于列表')}>
          <Text style={styles.btn2Text}>info</Text>
        </Pressable>
        <Pressable style={[styles.btn2, busy && styles.disabled]} disabled={busy}
          onPress={() => void run('team.leave', {}, '已退出')}>
          <Text style={styles.btn2Text}>leave</Text>
        </Pressable>
        <Pressable style={[styles.btn2Danger, busy && styles.disabled]} disabled={busy}
          onPress={() => void run('team.disband', {}, '已解散')}>
          <Text style={styles.btn2Text}>disband</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.joinLabel}>加入方式：</Text>
        <Pressable style={[styles.btn2, busy && styles.disabled]} disabled={busy}
          onPress={() => void run('team.joinmode', { mode: 'open' }, '已切换公开')}>
          <Text style={styles.btn2Text}>open</Text>
        </Pressable>
        <Pressable style={[styles.btn2, busy && styles.disabled]} disabled={busy}
          onPress={() => void run('team.joinmode', { mode: 'invite' }, '已切换邀请制')}>
          <Text style={styles.btn2Text}>invite</Text>
        </Pressable>
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {okMsg !== '' && <Text style={styles.ok}>{okMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
  title: { color: '#E8EEF9', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#16203A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#E8EEF9',
    fontSize: 14,
  },
  btn: {
    backgroundColor: '#2E6BE6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btn2: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2E6BE6',
  },
  btn2Danger: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E46A6A',
  },
  btn2Text: { color: '#6E9BF0', fontSize: 13 },
  joinLabel: { color: '#8FA3C7', fontSize: 12 },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { color: '#E46A6A', fontSize: 12, marginTop: 8 },
  ok: { color: '#4CC38A', fontSize: 12, marginTop: 8 },
});
