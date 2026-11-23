/**
 * 监控屏（迁移适配指南 §MonitorScreen，阶段 6）：metrics.network 5 秒轮询渲染节点帧。
 * 另提供 rank.sync（每 UUID 每日一次）与 admin.opSet（服主/超管）入口。
 * 权限：super/owner（契约 1.6.0）；普通账号展示后端的结构化拒绝。
 * MSPT/TPS 由服务端 TickMonitor 5s 窗口采集（HorizonModServer）。
 * 视觉对齐 AEMobileApp：节点卡 + 状态点 + TPS 进度条 + 分组设置行。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from './theme';
import {
  Card, Chip, EmptyState, GhostButton, PrimaryButton, ProgressBar,
  SectionLabel, SettingsGroup, SettingsRow, StatusDot, StyledInput,
} from './components';
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
  /** 当前选中的绑定身份；rank.sync 按 UUID 每日限次，缺省时禁用该入口。 */
  uuid?: string;
}

export function MonitorScreen({ conn, uuid = '' }: MonitorScreenProps): JSX.Element {
  const [nodes, setNodes] = useState<NodeFrame[]>([]);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);
  const [syncNodeId, setSyncNodeId] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [opTarget, setOpTarget] = useState('');
  const [opNodeId, setOpNodeId] = useState('');
  const [opMsg, setOpMsg] = useState('');
  const timerRef = useRef<any>(null);

  const applyOpSet = async (grant: boolean) => {
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
    }
  };

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

  const online = nodes.filter((n) => !n.offline && !!n.frame);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>网络监控</Text>
          <Text style={styles.sub}>在线节点 {online.length} / 共 {nodes.length}</Text>
        </View>
        <GhostButton
          label={polling ? '暂停轮询' : '恢复轮询'}
          icon={polling ? 'pause' : 'play'}
          tone="neutral"
          onPress={() => setPolling((v) => !v)}
        />
      </View>

      {error !== '' && (
        <View style={[styles.errBox, { backgroundColor: colors.badSoft, borderColor: colors.bad + '55' }]}>
          <Text style={[styles.errText, { color: colors.bad }]}>{error}</Text>
        </View>
      )}

      {nodes.length === 0 && error === '' && (
        <EmptyState icon="pulse-outline" title="网络内暂无活跃节点" subtitle="节点连上后端后会自动出现在这里" />
      )}

      {nodes.map((n) => {
        const live = !n.offline && !!n.frame;
        const tps = n.frame?.tps ?? 0;
        const ratio = Math.max(0, Math.min(1, tps / 20));
        return (
          <Card key={n.nodeId} style={{ marginTop: spacing.m }}>
            <View style={styles.nodeHead}>
              <View style={styles.nodeTitleRow}>
                <StatusDot ok={live} />
                <Text style={styles.nodeName}>{n.name ?? `节点 ${n.nodeId}`}</Text>
              </View>
              <Chip label={live ? '在线' : '离线'} tone={live ? 'ok' : 'warn'} />
            </View>
            {live && n.frame && (
              <>
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
                {(n.frame.dims ?? []).filter((d) => d.players > 0).map((d) => (
                  <View key={d.id} style={styles.dimRow}>
                    <Text style={styles.dimText}>维度 {d.id}</Text>
                    <Text style={styles.dimMeta}>{d.players} 人 ｜ MSPT {d.mspt.toFixed(2)}</Text>
                  </View>
                ))}
              </>
            )}
          </Card>
        );
      })}

      <SectionLabel text="在线榜同步" right={<Chip label="rank.sync" tone="accent2" />} />
      <Card>
        <Text style={styles.hint}>每 UUID 每日一次，需超管/服主权限。</Text>
        <View style={styles.row}>
          <StyledInput value={syncNodeId} onChangeText={setSyncNodeId} placeholder="节点 ID" keyboardType="number-pad" style={{ flex: 1 }} />
          <PrimaryButton
            label="同步到本服"
            icon="sync"
            disabled={syncNodeId.trim() === '' || uuid === ''}
            onPress={() => {
              setSyncMsg('');
              void conn.req('rank.sync', { uuid, nodeId: Number(syncNodeId) }).then((res) => {
                setSyncMsg(res.ok ? '已排队（queued）' : `rank.sync: ${res.m ?? '失败'}`);
              }).catch((e: any) => setSyncMsg(String(e.message ?? e)));
            }}
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
          <GhostButton label="授予" icon="shield-checkmark-outline" disabled={opTarget.trim() === '' || opNodeId.trim() === ''} onPress={() => void applyOpSet(true)} />
          <GhostButton label="撤销" icon="shield-outline" tone="bad" disabled={opTarget.trim() === '' || opNodeId.trim() === ''} onPress={() => void applyOpSet(false)} />
        </View>
        {opMsg !== '' && <Text style={styles.okText}>{opMsg}</Text>}
      </Card>
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
