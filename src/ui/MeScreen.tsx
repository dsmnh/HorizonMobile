/**
 * ME 设备屏（迁移适配指南 §ItemsScreen 基础，阶段 5）：
 * me.list 跨子服汇总（自有+被共享，含共享明细）+ me.share/unshare 管理。
 * 设备注册来自节点（me.register node op）；无设备时空态即预期。
 * me.query 由节点侧 AE2 执行器完成，App 先取 queryId 再轮询结果（契约 1.6.0 §8.5）。
 * 视觉对齐 AEMobileApp：设备卡 + 状态点 + 分组操作区。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { HorizonConn, type Res } from '../net/conn';
import { sharePayload, unsharePayload } from '../net/me-payload';
import { colors, radius, spacing, themedStyles } from './theme';
import {
  Card, Chip, EmptyState, GhostButton, PrimaryButton, SectionLabel, StatusDot, StyledInput,
} from './components';

interface DeviceRow {
  deviceId: string;
  nodeId: number;
  owner: string;
  kind: string;
  mine: boolean;
  shared: { uuid: string; level: string }[];
}

export interface MeScreenProps {
  conn: HorizonConn;
  uuid: string;
}

export function MeScreen({ conn, uuid }: MeScreenProps): JSX.Element {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [error, setError] = useState('');
  const [shareDevice, setShareDevice] = useState('');
  const [shareTarget, setShareTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState('');
  const [queryDevice, setQueryDevice] = useState('');
  const [queryId, setQueryId] = useState('');
  const [queryItems, setQueryItems] = useState<any[]>([]);
  const [queryMsg, setQueryMsg] = useState('');
  const [queryBusy, setQueryBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res: Res = await conn.req('me.list', { uuid });
      if (res.ok && Array.isArray(res.b?.devices)) {
        setDevices(res.b.devices.map((d: any) => ({
          deviceId: String(d.deviceId),
          nodeId: Number(d.nodeId),
          owner: String(d.owner),
          kind: String(d.kind ?? 'me'),
          mine: String(d.owner) === uuid,
          shared: Array.isArray(d.shared) ? d.shared : [],
        })));
      } else {
        setError(res.m ?? 'me.list 失败');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }, [conn, uuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareAction = async (unshare: boolean) => {
    // 取消共享同样按目标 UUID 定位条目，契约登记表的 me.unshare 载荷含 target。
    if (busy || !shareDevice.trim() || !shareTarget.trim()) return;
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const res: Res = unshare
        ? await conn.req('me.unshare', unsharePayload(uuid, shareDevice, shareTarget))
        : await conn.req('me.share', sharePayload(uuid, shareDevice, shareTarget));
      if (res.ok) {
        setOkMsg(unshare ? '已取消共享' : '已共享（control 级）');
        await load();
      } else {
        setError(res.m ?? '操作失败');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  /** 首次请求取回 queryId，随后以 queryId 轮询；节点离线或设备未登记由后端结构化拒绝。 */
  const runQuery = async (poll: boolean) => {
    if (queryBusy || (poll ? !queryId : !queryDevice.trim())) return;
    setQueryBusy(true);
    setQueryMsg('');
    try {
      const res: Res = poll
        ? await conn.req('me.query', { queryId })
        : await conn.req('me.query', { uuid, deviceId: queryDevice.trim() });
      if (!res.ok) {
        setQueryMsg(`me.query: ${res.m ?? '失败'}`);
        return;
      }
      if (res.b?.pending) {
        const nextId = String(res.b.queryId ?? queryId);
        setQueryId(nextId);
        setQueryItems([]);
        setQueryMsg(`查询执行中（${nextId}），点击「刷新结果」取回`);
      } else {
        setQueryItems(Array.isArray(res.b?.items) ? res.b.items : []);
        setQueryMsg(res.b?.error ? `节点回报：${res.b.error}` : '查询完成');
      }
    } catch (e: any) {
      setQueryMsg(String(e.message ?? e));
    } finally {
      setQueryBusy(false);
    }
  };

  const mine = devices.filter((d) => d.mine);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>ME 设备</Text>
          <Text style={styles.sub}>自有 {mine.length} ｜ 可见 {devices.length}</Text>
        </View>
        <GhostButton label="刷新" icon="refresh" tone="neutral" onPress={() => void load()} />
      </View>

      {error !== '' && (
        <View style={[styles.errBox, { backgroundColor: colors.badSoft, borderColor: colors.bad + '55' }]}>
          <Text style={[styles.errText, { color: colors.bad }]}>{error}</Text>
        </View>
      )}
      {okMsg !== '' && (
        <View style={[styles.errBox, { backgroundColor: colors.okSoft, borderColor: colors.ok + '55' }]}>
          <Text style={[styles.errText, { color: colors.ok }]}>{okMsg}</Text>
        </View>
      )}

      {devices.length === 0 && error === '' && (
        <EmptyState
          icon="hardware-chip-outline"
          title="暂无 ME 设备"
          subtitle="放置 ME 管理方块并由节点注册后在此显示"
        />
      )}

      {devices.map((d) => (
        <Card key={d.deviceId} style={{ marginTop: spacing.m }}>
          <View style={styles.devHead}>
            <View style={styles.devTitleRow}>
              <StatusDot ok />
              <Text style={styles.devId} numberOfLines={1}>{d.deviceId}</Text>
            </View>
            <Chip label={d.mine ? '自有' : '共享'} tone={d.mine ? 'accent' : 'accent2'} />
          </View>
          <Text style={styles.devMeta}>
            {d.mine ? `节点 ${d.nodeId} · ${d.kind}` : `来自 ${d.owner} · 节点 ${d.nodeId}`}
          </Text>
          {d.shared.length > 0 && (
            <Text style={styles.shared} numberOfLines={2}>
              共享给：{d.shared.map((s) => `${s.uuid}（${s.level}）`).join('，')}
            </Text>
          )}
          <View style={styles.actRow}>
            {d.mine && (
              <GhostButton
                label={shareDevice === d.deviceId ? '已选中共享' : '管理共享'}
                icon="share-social-outline"
                tone={shareDevice === d.deviceId ? 'accent' : 'neutral'}
                onPress={() => setShareDevice(d.deviceId)}
              />
            )}
            <GhostButton
              label={queryDevice === d.deviceId ? '已选中查询' : '查询物品'}
              icon="search"
              tone={queryDevice === d.deviceId ? 'accent' : 'neutral'}
              onPress={() => { setQueryDevice(d.deviceId); setQueryId(''); setQueryItems([]); }}
            />
          </View>
        </Card>
      ))}

      {mine.length > 0 && (
        <>
          <SectionLabel text="共享管理" right={<Chip label="me.share / me.unshare" tone="accent2" />} />
          <Card>
            <Text style={styles.hint}>选中设备：{shareDevice || '未选择'}</Text>
            <StyledInput value={shareTarget} onChangeText={setShareTarget} placeholder="共享目标 UUID（level=control）" />
            <View style={[styles.actRow, { marginTop: spacing.s }]}>
              <PrimaryButton label="共享" icon="person-add-outline" loading={busy}
                disabled={busy || shareTarget.trim() === ''} onPress={() => void shareAction(false)} />
              <GhostButton label="取消共享" icon="person-remove-outline" tone="bad"
                disabled={busy || shareDevice.trim() === ''} onPress={() => void shareAction(true)} />
            </View>
          </Card>
        </>
      )}

      <SectionLabel text="AE2 物品查询" right={<Chip label="me.query" tone="accent2" />} />
      <Card>
        <StyledInput value={queryDevice} onChangeText={setQueryDevice} placeholder="设备 ID（点上方设备自动填入）" />
        <View style={[styles.actRow, { marginTop: spacing.s }]}>
          <PrimaryButton label="发起查询" icon="flash-outline" loading={queryBusy}
            disabled={queryBusy || queryDevice.trim() === ''} onPress={() => void runQuery(false)} />
          <GhostButton label="刷新结果" icon="refresh-outline"
            disabled={queryBusy || queryId === ''} onPress={() => void runQuery(true)} />
        </View>
        {queryMsg !== '' && <Text style={styles.queryMsg}>{queryMsg}</Text>}
        {queryItems.map((it, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {String(it.displayName ?? it.item ?? '未知物品')}
            </Text>
            <Text style={styles.itemCount}>× {String(it.count ?? 0)}</Text>
          </View>
        ))}
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
  devHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  devTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flex: 1 },
  devId: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  devMeta: { color: colors.textDim, fontSize: 12, marginTop: spacing.s },
  shared: { color: colors.textFaint, fontSize: 11, marginTop: spacing.xs },
  actRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.m },
  hint: { color: colors.textFaint, fontSize: 11, marginBottom: spacing.s },
  queryMsg: { color: colors.textDim, fontSize: 12, marginTop: spacing.s },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s },
  itemName: { color: colors.text, fontSize: 13, flex: 1, marginRight: spacing.s },
  itemCount: { color: colors.accent, fontSize: 13, fontWeight: '600' },
}));
