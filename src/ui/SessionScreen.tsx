/**
 * 会话管理屏（迁移适配指南 §SettingsScreen 会话域）：列出本账号全部活跃会话并支持撤销。
 * 协议面：account.sessions（current 标记）+ account.revokeSession（契约 §3.5）。
 * 撤销当前会话将触发本端断开（后端 runAfterResponse(conn::close)），上层据此回登录屏。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../ui/theme';
import { HorizonConn, type Res } from '../net/conn';

interface SessionRow {
  id: string;
  app: string;
  lastSeen: number;
  current: boolean;
}

export interface SessionScreenProps {
  conn: HorizonConn;
  onSelfRevoked?: () => void;
}

export function SessionScreen({ conn, onSelfRevoked }: SessionScreenProps): JSX.Element {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const res: Res = await conn.req('account.sessions');
      if (res.ok && Array.isArray(res.b?.sessions)) {
        setSessions(res.b.sessions as SessionRow[]);
      } else {
        setError(res.m ?? 'account.sessions 失败');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }, [conn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revoke = async (s: SessionRow) => {
    setError('');
    try {
      const res: Res = await conn.req('account.revokeSession', { id: s.id });
      if (!res.ok) {
        setError(res.m ?? '撤销失败');
        return;
      }
      if (s.current) {
        // 本端会话被撤销：后端会在应答后断开，直接通知上层回登录屏
        onSelfRevoked?.();
      } else {
        void refresh();
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>会话管理</Text>
        <Pressable style={styles.refreshBtn} onPress={() => void refresh()}>
          <Text style={styles.refreshText}>刷新</Text>
        </Pressable>
      </View>
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {sessions.map((s) => (
        <View key={s.id} style={styles.row}>
          <View style={styles.meta}>
            <Text style={styles.app}>{s.app || '未知客户端'}{s.current ? '（当前）' : ''}</Text>
            <Text style={styles.seen}>最近活跃 {new Date(s.lastSeen * 1000).toLocaleString()}</Text>
          </View>
          <Pressable style={styles.revokeBtn} onPress={() => void revoke(s)}>
            <Text style={styles.revokeText}>撤销</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.primary },
  refreshText: { color: colors.primaryText, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12, marginTop: 8 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: { flex: 1, marginRight: 8 },
  app: { color: colors.text, fontSize: 14 },
  seen: { color: colors.faint, fontSize: 11, marginTop: 2 },
  revokeBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  revokeText: { color: colors.danger, fontSize: 12 },
});
