/**
 * 监控屏（迁移适配指南 §MonitorScreen，阶段 6）：metrics.network 5 秒轮询渲染节点帧。
 * 权限：super/owner（契约 1.5.0）；普通账号展示后端的结构化拒绝。
 * MSPT/TPS 由服务端 TickMonitor 5s 窗口采集（HorizonModServer）。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#E8EEF9', fontSize: 16, fontWeight: '600' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#2E6BE6' },
  toggleText: { color: '#6E9BF0', fontSize: 12 },
  error: { color: '#E46A6A', fontSize: 13, marginTop: 8 },
  empty: { color: '#5A6B8C', fontSize: 13, marginTop: 10 },
  nodeCard: {
    backgroundColor: '#16203A',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  nodeName: { color: '#E8EEF9', fontSize: 15 },
  online: { color: '#4CC38A', fontSize: 12 },
  offline: { color: '#E4A24C', fontSize: 12 },
  metrics: { color: '#8FA3C7', fontSize: 13, marginTop: 6 },
  dim: { color: '#5A6B8C', fontSize: 11, marginTop: 3 },
});
