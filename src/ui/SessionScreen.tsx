/**
 * 会话管理屏（迁移适配指南 §SettingsScreen 会话域）：列出本账号全部活跃会话并支持撤销。
 * 协议面：account.sessions（current 标记）+ account.revokeSession（契约 §3.5）。
 * 撤销当前会话将触发本端断开（后端 runAfterResponse(conn::close)），上层据此回登录屏。
 * 视觉对齐 AEMobileApp：会话卡 + 当前会话状态点。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from './theme';
import { Card, Chip, EmptyState, GhostButton, StatusDot } from './components';
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
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>会话管理</Text>
          <Text style={styles.sub}>共 {sessions.length} 个会话</Text>
        </View>
        <GhostButton label="刷新" icon="refresh" tone="neutral" onPress={() => void refresh()} />
      </View>

      {error !== '' && (
        <View style={[styles.errBox, { backgroundColor: colors.badSoft, borderColor: colors.bad + '55' }]}>
          <Text style={[styles.errText, { color: colors.bad }]}>{error}</Text>
        </View>
      )}

      {sessions.length === 0 && error === '' && (
        <EmptyState icon="shield-checkmark-outline" title="暂无会话" subtitle="点刷新重新拉取会话列表" />
      )}

      {sessions.map((s) => (
        <Card key={s.id} style={{ marginTop: spacing.m }}>
          <View style={styles.rowHead}>
            <View style={styles.appRow}>
              <StatusDot ok={s.current} />
              <Text style={styles.app} numberOfLines={1}>{s.app || '未知客户端'}</Text>
            </View>
            {s.current && <Chip label="当前" tone="ok" />}
          </View>
          <Text style={styles.seen}>最近活跃 {new Date(s.lastSeen * 1000).toLocaleString()}</Text>
          <View style={styles.actRow}>
            <GhostButton label="撤销会话" icon="close-circle-outline" tone="bad" onPress={() => void revoke(s)} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  errBox: { marginTop: spacing.m, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  errText: { fontSize: 12, lineHeight: 17 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flex: 1 },
  app: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  seen: { color: colors.textFaint, fontSize: 11, marginTop: spacing.s },
  actRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
}));
