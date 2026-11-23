/**
 * 队伍屏（迁移适配指南 §阶段 2）：绑定 UUID 的队伍列表与实时事件流。
 * 协议面：team.list（REQ）+ subscribeTeam（SUB，契约 1.2.0 sid/seq 语义）。
 * 队伍操作（create/invite/…）在 TeamOpsScreen / TeamRosterScreen 内。
 * 视觉对齐 AEMobileApp：队伍卡 + 状态点 + 实时事件胶囊。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from './theme';
import { Card, Chip, EmptyState, GhostButton, StatusDot } from './components';
import { HorizonConn, type Stream, type TeamEvent } from '../net/conn';

interface TeamRow {
  teamId: number;
  name: string;
  memberCount: number;
  joinMode: string;
}

export interface TeamScreenProps {
  conn: HorizonConn;
  uuid: string;
}

export function TeamScreen({ conn, uuid }: TeamScreenProps): JSX.Element {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [error, setError] = useState('');
  const [lastEvent, setLastEvent] = useState<TeamEvent | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const streamRef = useRef<Stream | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await conn.req('team.list', { uuid });
      if (res.ok && Array.isArray(res.b?.teams)) {
        setTeams(res.b.teams as TeamRow[]);
      } else {
        setError(res.m ?? 'team.list 失败');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setRefreshing(false);
    }
  }, [conn, uuid]);

  // 订阅 team 流：事件仅刷新提示（增量语义按契约 §6，合并逻辑随队伍操作屏接入）
  useEffect(() => {
    const stream = conn.subscribeTeam(uuid);
    streamRef.current = stream;
    stream.addEventListener((e) => setLastEvent(e));
    void refresh();
    return () => {
      stream.close();
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, uuid]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>队伍</Text>
          <Text style={styles.sub}>共 {teams.length} 支队伍</Text>
        </View>
        <GhostButton label={refreshing ? '刷新中…' : '刷新'} icon="refresh" tone="neutral"
          disabled={refreshing} onPress={() => void refresh()} />
      </View>

      {lastEvent != null && (
        <View style={styles.eventRow}>
          <StatusDot ok />
          <Text style={styles.event} numberOfLines={1}>
            实时事件 {lastEvent.k} · seq {lastEvent.seq}
          </Text>
        </View>
      )}

      {error !== '' && (
        <View style={[styles.errBox, { backgroundColor: colors.badSoft, borderColor: colors.bad + '55' }]}>
          <Text style={[styles.errText, { color: colors.bad }]}>{error}</Text>
        </View>
      )}

      {teams.length === 0 && error === '' && (
        <EmptyState icon="people-outline" title="尚未加入任何队伍" subtitle="在队伍操作页创建或接受邀请" />
      )}

      {teams.map((t) => (
        <Card key={t.teamId} style={{ marginTop: spacing.m }}>
          <View style={styles.teamHead}>
            <Text style={styles.teamName}>{t.name}</Text>
            <Chip label={t.joinMode === 'open' ? '公开' : '邀请制'} tone={t.joinMode === 'open' ? 'ok' : 'neutral'} />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>队伍 ID</Text>
            <Text style={styles.metaValue}>{t.teamId}</Text>
            <Text style={styles.metaLabel}>成员</Text>
            <Text style={styles.metaValue}>{t.memberCount} 人</Text>
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
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.m },
  event: { color: colors.ok, fontSize: 12, flex: 1 },
  errBox: { marginTop: spacing.m, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  errText: { fontSize: 12, lineHeight: 17 },
  teamHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.s, marginTop: spacing.s, flexWrap: 'wrap' },
  metaLabel: { color: colors.textFaint, fontSize: 11 },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 18 },
}));
