/**
 * 监控屏（迁移适配指南 §MonitorScreen，阶段 6）：metrics.network 5 秒轮询渲染节点帧。
 * 另提供 rank.sync（每 UUID 每日一次）与 admin.opSet（服主/超管）入口。
 * 权限：super/owner（契约 1.6.0）；普通账号展示后端的结构化拒绝。
 * MSPT/TPS 由服务端 TickMonitor 5s 窗口采集（HorizonModServer）。
 * 视觉对齐 AEMobileApp：节点卡 + 状态点 + TPS 进度条 + 分组设置行。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { colors, spacing, themedStyles } from './theme';
import {
  Card, Chip, EmptyState, GhostButton, PrimaryButton, ProgressBar,
  PageHeader, SectionLabel, StateNotice, StatusDot, StyledInput,
} from './components';
import { HorizonConn, type Res } from '../net/conn';

interface NodeFrame {
  nodeId: number;
  name?: string;
  offline?: boolean;
  frame?: {
    at?: number;
    mspt: number;
    max?: number;
    tps: number;
    players: number;
    dims?: { id: number; name: string; players: number; mspt?: number }[];
  };
}

export interface MonitorScreenProps {
  conn: HorizonConn;
  /** 当前选中的绑定身份；rank.sync 按 UUID 每日限次，缺省时禁用该入口。 */
  uuid?: string;
  connected: boolean;
  management?: boolean;
}

type Sample = { ts: number; tps: number; mspt: number };

export function MonitorScreen({ conn, uuid = '', connected, management = false }: MonitorScreenProps): JSX.Element {
  const focused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const [received, setReceived] = useState(false);
  const [samples, setSamples] = useState<Record<number, Sample[]>>({});
  const inFlight = useRef(false);
  const operation = useRef(false);
  const [busy, setBusy] = useState(false);
  const [nodes, setNodes] = useState<NodeFrame[]>([]);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);
  const [syncNodeId, setSyncNodeId] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [opTarget, setOpTarget] = useState('');
  const [opNodeId, setOpNodeId] = useState('');
  const [opMsg, setOpMsg] = useState('');


  const applyOpSet = async (grant: boolean) => {
    if (operation.current || !conn.isConnected) return;
    operation.current = true;
    setBusy(true);
    setOpMsg('');
    try {
      const res: Res = await conn.req('admin.opSet', {
        uuid: opTarget.trim(),
        nodeId: Number(opNodeId),
        grant,
      });
      setOpMsg(res.ok
        ? (res.b?.queued ? '已入队（节点离线）' : '已下发到节点')
        : `admin.opSet: ${res.m ?? '失败'}`);
    } catch (e: any) {
      setOpMsg(String(e.message ?? e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const refresh = useCallback(async () => {
    if (!conn.isConnected || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    setError('');
    try {
      const res: Res = await conn.req('metrics.network', {});
      if (!res.ok || !Array.isArray(res.b?.nodes)) {
        if (res.m === 'FORBIDDEN') {
          setNodes([]);
          setSamples({});
        }
        setError(res.m ?? '无法读取网络监控');
        return;
      }
      const incoming: NodeFrame[] = res.b.nodes;
      setNodes((previous) => {
        const cached = new Map(previous.map((node) => [node.nodeId, node.frame]));
        return incoming.map((node) => ({ ...node, frame: node.frame ?? (node.offline ? cached.get(node.nodeId) : undefined) }));
      });
      setSamples((previous) => {
        const next: Record<number, Sample[]> = {};
        for (const node of incoming) {
          const series = previous[node.nodeId] ?? [];
          const frame = node.frame;
          if (!node.offline && frame && typeof frame.at === 'number' && Number.isFinite(frame.at)
            && Number.isFinite(frame.tps) && Number.isFinite(frame.mspt) && frame.at > (series[series.length - 1]?.ts ?? 0)) {
            next[node.nodeId] = [...series, { ts: frame.at, tps: frame.tps, mspt: frame.mspt }].slice(-24);
          } else {
            next[node.nodeId] = series;
          }
        }
        return next;
      });
      setReceived(true);
    } catch (cause) {
      if (conn.isConnected) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [conn]);

  useEffect(() => {
    if (management || !connected || !focused) return;
    void refresh();
    if (!polling) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [management, connected, focused, polling, refresh]);

  const syncRank = async () => {
    if (operation.current || !conn.isConnected) return;
    operation.current = true;
    setBusy(true);
    setSyncMsg('');
    try {
      const res = await conn.req('rank.sync', { uuid, nodeId: Number(syncNodeId) });
      setSyncMsg(res.ok ? '已加入同步队列' : res.m ?? '同步失败');
    } catch (cause) {
      setSyncMsg(cause instanceof Error ? cause.message : String(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const online = connected ? nodes.filter((node) => !node.offline && !!node.frame).length : 0;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
      {!management && <>
      <PageHeader title="监控" connected={connected} onRefresh={() => void refresh()} refreshing={refreshing} />
      <View style={styles.headRow}>
        <Text style={styles.sub}>{connected ? '在线节点 ' + online + ' / 共 ' + nodes.length : '缓存节点 ' + nodes.length}</Text>
        <GhostButton label={polling ? '暂停轮询' : '恢复轮询'} icon={polling ? 'pause' : 'play'} tone="neutral"
          disabled={!connected} onPress={() => setPolling((value) => !value)} />
      </View>
      {!connected && <StateNotice>连接已中断，已读取的指标以缓存显示</StateNotice>}
      {connected && error !== '' && <StateNotice tone="bad">{error}</StateNotice>}
      {connected && !received && !error && <StateNotice tone="neutral" loading>正在读取节点指标</StateNotice>}
      {connected && received && nodes.length === 0 && !error && (
        <EmptyState icon="pulse-outline" title="暂无节点" subtitle="节点上报指标后会显示在这里" />
      )}

      {nodes.map((n) => {
        const live = connected && !n.offline && !!n.frame;
        const tps = n.frame?.tps ?? 0;
        const ratio = Math.max(0, Math.min(1, tps / 20));
        return (
          <Card key={n.nodeId} style={{ marginTop: spacing.m }}>
            <View style={styles.nodeHead}>
              <View style={styles.nodeTitleRow}>
                <StatusDot ok={live} />
                <Text style={styles.nodeName}>{n.name ?? `节点 ${n.nodeId}`}</Text>
              </View>
              <Chip label={live ? '在线' : n.frame ? '离线 · 缓存' : '离线'} tone={live ? 'ok' : 'warn'} />
            </View>
            {n.frame ? (
              <>
                {typeof n.frame.at === 'number' && <Text style={styles.peak}>更新时间 {new Date(n.frame.at * 1000).toLocaleTimeString()}</Text>}
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>TPS</Text>
                  <Text style={[styles.metricValue, { color: ratio > 0.9 ? colors.ok : colors.warn }]}>
                    {n.frame.tps.toFixed(1)}
                  </Text>
                  <Text style={styles.metricLabel}>MSPT</Text>
                  <Text style={styles.metricValue}>{n.frame.mspt.toFixed(1)}</Text>
                  <Text style={styles.metricLabel}>玩家</Text>
                  <Text style={styles.metricValue}>{n.frame.players}</Text>
                </View>
                <View style={{ marginTop: spacing.s }}>
                  <ProgressBar ratio={ratio} tone={ratio > 0.9 ? 'ok' : 'warn'} />
                </View>
                {n.frame.max != null && (
                  <Text style={styles.peak}>MSPT 峰值 {n.frame.max.toFixed(1)}</Text>
                )}
                {(n.frame.dims ?? []).map((d) => (
                  <View key={d.id} style={styles.dimRow}>
                    <Text style={styles.dimText}>{d.name || `维度 ${d.id}`}</Text>
                    <Text style={styles.dimMeta}>{d.players} 人 ｜ MSPT {typeof d.mspt === 'number' ? d.mspt.toFixed(2) : '—'}</Text>
                  </View>
                ))}
                <Trend samples={samples[n.nodeId] ?? []} />
              </>
            ) : <Text style={styles.peak}>暂无节点指标</Text>}
          </Card>
        );
      })}
      </>}
      {management && <>
      <PageHeader title="服务器管理" connected={connected} />
      <SectionLabel text="在线榜同步" right={<Chip label="rank.sync" tone="accent2" />} />
      <Card>
        <Text style={styles.hint}>每 UUID 每日一次，需超管/服主权限。</Text>
        <View style={styles.row}>
          <StyledInput value={syncNodeId} onChangeText={setSyncNodeId} placeholder="节点 ID" keyboardType="number-pad" style={{ flex: 1 }} />
          <PrimaryButton
            label="同步到本服"
            icon="sync"
            disabled={!connected || busy || !/^\d+$/.test(syncNodeId.trim()) || !uuid}
            onPress={() => void syncRank()}
          />
        </View>
        {syncMsg !== '' && <Text style={styles.okText}>{syncMsg}</Text>}
      </Card>

      <SectionLabel text="玩家 OP 管理" right={<Chip label="admin.opSet" tone="accent2" />} />
      <Card>
        <Text style={styles.hint}>目标需在线；离线或非法 UUID 由节点侧拒绝。</Text>
        <StyledInput value={opTarget} onChangeText={setOpTarget} placeholder="目标玩家 UUID" />
        <View style={[styles.row, { marginTop: spacing.s }]}>
          <StyledInput value={opNodeId} onChangeText={setOpNodeId} placeholder="节点 ID" keyboardType="number-pad" style={{ flex: 1 }} />
          <GhostButton label="授予" icon="shield-checkmark-outline" disabled={!connected || busy || opTarget.trim() === '' || !/^\d+$/.test(opNodeId.trim())} onPress={() => void applyOpSet(true)} />
          <GhostButton label="撤销" icon="shield-outline" tone="bad" disabled={!connected || busy || opTarget.trim() === '' || !/^\d+$/.test(opNodeId.trim())} onPress={() => void applyOpSet(false)} />
        </View>
        {opMsg !== '' && <Text style={styles.okText}>{opMsg}</Text>}
      </Card>
      </>}
    </ScrollView>
  );
}

function Trend({ samples }: { samples: Sample[] }): JSX.Element {
  if (samples.length < 2) return <Text style={styles.peak}>趋势 · 等待更多采样</Text>;
  const recent = samples.slice(-12);
  const peak = Math.max(1, ...recent.map(({ mspt }) => mspt));
  return <View style={{ marginTop: spacing.m }}>
    <Text style={styles.peak}>最近 {recent.length} 次采样 · TPS / MSPT</Text>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 36, gap: 3 }}>
      {recent.map((sample) => <View key={sample.ts} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', height: 34, gap: 1 }}>
        <View style={{ flex: 1, height: Math.max(0, Math.min(34, sample.tps / 20 * 34)), backgroundColor: colors.accent }} />
        <View style={{ flex: 1, height: Math.max(0, sample.mspt / peak * 34), backgroundColor: colors.accent2 }} />
      </View>)}
    </View>
  </View>;
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  nodeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nodeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  nodeName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.s, marginTop: spacing.m, flexWrap: 'wrap' },
  metricLabel: { color: colors.textFaint, fontSize: 11 },
  metricValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  peak: { color: colors.textFaint, fontSize: 11, marginTop: spacing.s },
  dimRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s },
  dimText: { color: colors.textDim, fontSize: 12 },
  dimMeta: { color: colors.textFaint, fontSize: 11 },
  hint: { color: colors.textFaint, fontSize: 11, marginBottom: spacing.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  okText: { color: colors.ok, fontSize: 12, marginTop: spacing.s },
}));
