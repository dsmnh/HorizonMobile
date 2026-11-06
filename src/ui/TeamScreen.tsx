/**
 * 队伍屏（迁移适配指南 §阶段 2）：绑定 UUID 的队伍列表与实时事件流。
 * 协议面：team.list（REQ）+ subscribeTeam（SUB，契约 1.2.0 sid/seq 语义）。
 * 队伍操作（create/invite/…）随下一迁移增量接入。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>队伍</Text>
        <Pressable style={styles.refreshBtn} disabled={refreshing} onPress={() => void refresh()}>
          <Text style={styles.refreshText}>{refreshing ? '刷新中…' : '刷新'}</Text>
        </Pressable>
      </View>

      {lastEvent != null && (
        <Text style={styles.event} numberOfLines={1}>
          实时：{lastEvent.k}（seq {lastEvent.seq}）
        </Text>
      )}

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      {teams.length === 0 && error === '' && (
        <Text style={styles.empty}>尚未加入任何队伍。</Text>
      )}

      {teams.map((t) => (
        <View key={t.teamId} style={styles.row}>
          <Text style={styles.teamName}>{t.name}</Text>
          <Text style={styles.teamMeta}>
            {t.memberCount} 人 · {t.joinMode === 'open' ? '公开' : '邀请制'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#E8EEF9', fontSize: 22, fontWeight: '700' },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#2E6BE6' },
  refreshText: { color: '#6E9BF0', fontSize: 12 },
  event: { color: '#4CC38A', fontSize: 12, marginTop: 8 },
  error: { color: '#E46A6A', fontSize: 13, marginTop: 10 },
  empty: { color: '#5A6B8C', fontSize: 13, marginTop: 10 },
  row: {
    backgroundColor: '#16203A',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamName: { color: '#E8EEF9', fontSize: 15 },
  teamMeta: { color: '#8FA3C7', fontSize: 12 },
});
