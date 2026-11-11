/**
 * 设置屏（迁移适配指南 §SettingsScreen）：本地偏好、缓存管理与账号绑定身份查询。
 * account.uuids 返回当前账号绑定的 UUID 与可选玩家名（契约 1.6.0 §8.7）。
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './theme';
import { HorizonConn, type Res } from '../net/conn';

interface Identity {
  uuid: string;
  name?: string;
}

export interface SettingsScreenProps {
  conn?: HorizonConn;
}

export function SettingsScreen({ conn }: SettingsScreenProps): JSX.Element {
  const [msg, setMsg] = useState('');
  const [identities, setIdentities] = useState<Identity[]>([]);

  const clearConn = async () => {
    try {
      await AsyncStorage.removeItem('horizon.conn.last');
      setMsg('已清除上次连接信息');
    } catch {
      setMsg('清除失败（存储不可用）');
    }
  };

  const loadIdentities = async () => {
    if (!conn) {
      setMsg('未连接后端');
      return;
    }
    try {
      const res: Res = await conn.req('account.uuids', {});
      if (!res.ok || !Array.isArray(res.b?.uuids)) {
        setMsg(`account.uuids: ${res.m ?? '失败'}`);
        return;
      }
      setIdentities(res.b.uuids.map((u: any) => ({
        uuid: String(u.uuid),
        name: u.name == null ? undefined : String(u.name),
      })));
      setMsg(`已读取 ${res.b.uuids.length} 个绑定身份`);
    } catch (e: any) {
      setMsg(String(e.message ?? e));
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>设置</Text>
      <Pressable style={styles.btn} onPress={() => void clearConn()}>
        <Text style={styles.btnText}>清除上次连接信息</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>账号绑定身份（account.uuids）</Text>
      <Pressable style={styles.btnOutline} disabled={!conn} onPress={() => void loadIdentities()}>
        <Text style={styles.btnOutlineText}>查询绑定身份</Text>
      </Pressable>
      {identities.map((id) => (
        <View key={id.uuid} style={styles.idRow}>
          <Text style={styles.idText} numberOfLines={1}>
            {id.name ? `${id.name} · ${id.uuid}` : id.uuid}
          </Text>
        </View>
      ))}
      {msg !== '' && <Text style={styles.msg}>{msg}</Text>}
      <Text style={styles.note}>
        监控轮询开关与 rank.sync / admin.opSet 位于监控屏；重设密码在登录屏。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sectionLabel: { color: colors.faint, fontSize: 11, marginTop: 16 },
  btn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  btnOutline: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  btnOutlineText: { color: colors.primaryText, fontSize: 13 },
  idRow: { backgroundColor: colors.card, borderRadius: 8, padding: 10, marginTop: 6 },
  idText: { color: colors.text, fontSize: 12 },
  msg: { color: colors.ok, fontSize: 12, marginTop: 8 },
  note: { color: colors.faint, fontSize: 12, marginTop: 12, lineHeight: 18 },
});
