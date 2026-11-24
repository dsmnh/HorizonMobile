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
  /** 转发队伍流事件，供页面内其它分区（如官方队伍投影）按事件类型增量刷新。 */
  onEvent?: (event: TeamEvent) => void;
}

export function TeamScreen({ conn, uuid, onEvent }: TeamScreenProps): JSX.Element {
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [membership, setMembership] = useState<{ name?: string; teamId?: number; members?: { uuid: string; role: string }[] } | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [error, setError] = useState('');
  const [lastEvent, setLastEvent] = useState<TeamEvent | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const streamRef = useRef<Stream | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const [res, info] = await Promise.all([conn.req('team.list', { uuid }), conn.req('team.info', { uuid })]);
      if (info.ok || info.m === 'NOT_IN_TEAM') {
        const team = info.ok ? info.b?.team : null;
        setMembership(team ? { ...team, members: Array.isArray(team.members) ? team.members : [] } : null);
        setMembershipLoaded(true);
      } else {
        setError(info.m ?? 'team.info 失败');
      }
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
    stream.addEventListener((e) => {
      setLastEvent(e);
      // 1.6.5：官方队伍投影或映射变化时，由上层按事件类型重取 team.official
      if (e.k === 'officialUpdated' || e.k === 'officialMapChanged') onEvent?.(e);
    });
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
          <Text style={styles.sub}>当前身份 {uuid}</Text>
        </View>
        <GhostButton label={refreshing ? '刷新中…' : '刷新'} icon="refresh" tone="neutral"
          disabled={refreshing} onPress={() => void refresh()} />
      </View>

      <Card style={{ marginTop: spacing.m }}>
        <Text style={styles.teamName}>{membership ? (membership.name || `队伍 ${membership.teamId}`) : membershipLoaded ? '尚未加入队伍' : '队伍状态未加载'}</Text>
        <Text style={styles.hint}>{membership ? `成员 ${membership.members?.length ?? 0} 人 · 成员与审批页可处理邀请和申请` : '可在成员与审批页处理邀请或申请加入队伍'}</Text>
        {membership?.members?.map((member) => <Text key={member.uuid} style={styles.metaValue}>{member.uuid} · {member.role}</Text>)}
      </Card>

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
        <EmptyState icon="people-outline" title="暂无队伍列表" subtitle="可在队伍操作页创建队伍" />
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
