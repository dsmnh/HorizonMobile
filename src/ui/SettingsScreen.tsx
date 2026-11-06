/**
 * 设置屏（迁移适配指南 §SettingsScreen）：本地偏好与缓存管理。
 * 协议无关（guide 定性「本地设置保留」）：当前提供上次连接信息清除；监控轮询开关在监控屏内。
 * 主题切换随主题系统增量扩展（src/ui/theme.ts palette）。
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './theme';

export function SettingsScreen(): JSX.Element {
  const [msg, setMsg] = useState('');

  const clearConn = async () => {
    try {
      await AsyncStorage.removeItem('horizon.conn.last');
      setMsg('已清除上次连接信息');
    } catch {
      setMsg('清除失败（存储不可用）');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>设置</Text>
      <Pressable style={styles.btn} onPress={() => void clearConn()}>
        <Text style={styles.btnText}>清除上次连接信息</Text>
      </Pressable>
      {msg !== '' && <Text style={styles.ok}>{msg}</Text>}
      <Text style={styles.note}>
        监控轮询开关位于监控屏；主题基线为深空矩阵配色（src/ui/theme.ts），换肤随增量扩展。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  btn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  ok: { color: colors.ok, fontSize: 12, marginTop: 8 },
  note: { color: colors.faint, fontSize: 12, marginTop: 12, lineHeight: 18 },
});
