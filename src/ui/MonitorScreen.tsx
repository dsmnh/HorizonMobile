/**
 * 监控屏（迁移适配指南 §MonitorScreen，阶段 6）：metrics.network 5 秒轮询渲染节点帧。
 * 权限：super/owner（契约 1.5.0）；普通账号展示后端的结构化拒绝。
 * MSPT/TPS 由服务端 TickMonitor 5s 窗口采集（HorizonModServer）。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from './theme';
import { HorizonConn, type Res } from '../net/conn';

interface NodeFrame {
  nodeId: number;
  name?: string;
  offline?: boolean;
  frame?: {
    mspt: number;
    max?: number;
    tps: number;
    players: number;
    dims?: { id: number; name: string; players: number; mspt: number }[];
  };
}

export interface MonitorScreenProps {
  conn: HorizonConn;
}

export function MonitorScreen({ conn }: MonitorScreenProps): JSX.Element {
  const [nodes, setNodes] = useState<NodeFrame[]>([]);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);
  const [syncNodeId, setSyncNodeId] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const timerRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const res: Res = await conn.req('metrics.network', {});
      if (res.ok && Array.isArray(res.b?.nodes)) {
        setNodes(res.b.nodes as NodeFrame[]);
      } else {
        setError(res.m ?? 'metrics.network 失败（需要 super/owner 账号）');
        setNodes([]);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }, [conn]);

  useEffect(() => {
    void refresh();
    if (polling) {
      timerRef.current = setInterval(() => void refresh(), 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, polling]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>网络监控</Text>
        <Pressable style={styles.toggleBtn} onPress={() => setPolling((v) => !v)}>
          <Text style={styles.toggleText}>{polling ? '暂停轮询' : '恢复轮询'}</Text>
        </Pressable>
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {nodes.length === 0 && error === '' && <Text style={styles.empty}>网络内暂无活跃节点。</Text>}

      <Text style={styles.sectionLabel}>在线榜同步（rank.sync，每日每 UUID 一次；超管/服主）</Text>
      <View style={styles.syncRow}>
        <TextInput
          style={styles.syncInput}
          value={syncNodeId}
          onChangeText={setSyncNodeId}
          placeholder="节点 ID"
          placeholderTextColor={colors.faint}
          keyboardType="number-pad"
        />
        <Pressable style={styles.syncBtn} disabled={!syncNodeId.trim()}
          onPress={() => {
            setSyncMsg('');
            void conn.req('rank.sync', { nodeId: Number(syncNodeId) }).then((res) => {
              setSyncMsg(res.ok ? '已排队（queued）' : `rank.sync: ${res.m ?? '失败'}`);
            }).catch((e: any) => setSyncMsg(String(e.message ?? e)));
          }}>
          <Text style={styles.syncBtnText}>同步到本服</Text>
        </Pressable>
      </View>
      {syncMsg !== '' && <Text style={styles.syncMsg}>{syncMsg}</Text>}

      {nodes.map((n) => (
        <View key={n.nodeId} style={styles.nodeCard}>
          <View style={styles.nodeHeader}>
            <Text style={styles.nodeName}>{n.name ?? `节点 ${n.nodeId}`}</Text>
            {n.offline || !n.frame ? (
              <Text style={styles.offline}>离线/无帧</Text>
            ) : (
              <Text style={styles.online}>在线</Text>
            )}
          </View>
          {n.frame && !n.offline && (
            <>
              <Text style={styles.metrics}>
                TPS {n.frame.tps.toFixed(1)} ｜ MSPT {n.frame.mspt.toFixed(1)}
                {n.frame.max != null ? `（峰值 ${n.frame.max.toFixed(1)}）` : ''} ｜ 玩家 {n.frame.players}
              </Text>
              {(n.frame.dims ?? []).filter((d) => d.players > 0).map((d) => (
                <Text key={d.id} style={styles.dim}>
                  维度 {d.id}：{d.players} 人，MSPT {d.mspt.toFixed(2)}
                </Text>
              ))}
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 18 },
  sectionLabel: { color: colors.faint, fontSize: 11, marginTop: 14 },
  syncRow: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' },
  syncInput: {
    width: 90,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
  },
  syncBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  syncBtnText: { color: colors.primaryText, fontSize: 12 },
  syncMsg: { color: colors.ok, fontSize: 12, marginTop: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.primary },
  toggleText: { color: colors.primaryText, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  empty: { color: colors.faint, fontSize: 13, marginTop: 10 },
  nodeCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  nodeName: { color: colors.text, fontSize: 15 },
  online: { color: colors.ok, fontSize: 12 },
  offline: { color: colors.warn, fontSize: 12 },
  metrics: { color: colors.muted, fontSize: 13, marginTop: 6 },
  dim: { color: colors.faint, fontSize: 11, marginTop: 3 },
});
