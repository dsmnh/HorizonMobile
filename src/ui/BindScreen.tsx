/**
 * 绑定管理屏（迁移适配指南 §阶段 1 流程）：输入游戏内 /dsmnhmobile bind 出的绑定码，
 * 调 account.bindUUID 绑定游戏 UUID；成功后回调上层刷新 uuid 列表。
 * 绑定码 10 分钟有效且一次性、新码注销旧码（企划书 03）。
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HorizonConn, type Res } from '../net/conn';

export interface BindScreenProps {
  conn: HorizonConn;
  onBound: (uuids: string[]) => void;
}

export function BindScreen({ conn, onBound }: BindScreenProps): JSX.Element {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const submit = async () => {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res: Res = await conn.req('account.bindUUID', { code: c });
      if (res.ok) {
        const uuids = Array.isArray(res.b?.uuids) ? res.b.uuids : (res.b?.uuid ? [res.b.uuid] : []);
        setOk('绑定成功');
        setCode('');
        onBound(uuids);
      } else {
        setError(res.m ?? '绑定失败');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>绑定游戏 UUID</Text>
      <Text style={styles.hint}>
        进游戏执行 /dsmnhmobile bind 获取绑定码（10 分钟内有效，仅一次）。
      </Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="绑定码"
          placeholderTextColor="#5A6B8C"
          autoCapitalize="characters"
          editable={!busy}
        />
        <Pressable style={[styles.btn, busy && styles.disabled]} disabled={busy}
          onPress={() => void submit()}>
          <Text style={styles.btnText}>绑定</Text>
        </Pressable>
      </View>
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {ok !== '' && <Text style={styles.ok}>{ok}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 18 },
  title: { color: '#E8EEF9', fontSize: 16, fontWeight: '600' },
  hint: { color: '#5A6B8C', fontSize: 12, marginTop: 4, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    backgroundColor: '#16203A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E8EEF9',
    fontSize: 15,
  },
  btn: {
    backgroundColor: '#2E6BE6',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { color: '#E46A6A', fontSize: 13, marginTop: 8 },
  ok: { color: '#4CC38A', fontSize: 13, marginTop: 8 },
});
