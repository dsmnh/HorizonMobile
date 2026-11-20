/**
 * ME 设备屏（迁移适配指南 §ItemsScreen 基础，阶段 5）：
 * me.list 跨子服汇总（自有+被共享，含共享明细）+ me.share/unshare 管理。
 * 设备注册来自节点（me.register node op）；无设备时空态即预期。
 * me.query 由节点侧 AE2 执行器完成，App 先取 queryId 再轮询结果（契约 1.6.0 §8.5）。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HorizonConn, type Res } from '../net/conn';
import { sharePayload, unsharePayload } from '../net/me-payload';
import { colors } from './theme';

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

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>ME 设备</Text>
        <Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <Text style={styles.refreshText}>刷新</Text>
        </Pressable>
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {devices.length === 0 && error === '' && (
        <Text style={styles.empty}>
          暂无设备。放置 ME 管理方块并由节点注册后在此显示（阶段 5 设备域）。
        </Text>
      )}

      {devices.map((d) => (
        <View key={d.deviceId} style={styles.deviceCard}>
          <View style={styles.deviceHeader}>
            <Text style={styles.deviceId} numberOfLines={1}>{d.deviceId}</Text>
            <Text style={styles.deviceTag}>
              {d.mine ? '自有' : `共享自 ${d.owner}`} · 节点 {d.nodeId} · {d.kind}
            </Text>
          </View>
          {d.shared.length > 0 && (
            <Text style={styles.sharedText} numberOfLines={2}>
              共享给：{d.shared.map((s) => `${s.uuid}（${s.level}）`).join('，')}
            </Text>
          )}
          {d.mine && (
            <Pressable style={styles.pickBtn} onPress={() => setShareDevice(d.deviceId)}>
              <Text style={styles.pickText}>{shareDevice === d.deviceId ? '已选中（下方输入共享目标）' : '选中管理共享'}</Text>
            </Pressable>
          )}
          <Pressable style={styles.pickBtn} onPress={() => { setQueryDevice(d.deviceId); setQueryId(''); setQueryItems([]); }}>
            <Text style={styles.pickText}>{queryDevice === d.deviceId ? '已选中（下方可发起查询）' : '选中查询物品'}</Text>
          </Pressable>
        </View>
      ))}

      {devices.some((d) => d.mine) && (
        <View style={styles.shareRow}>
          <TextInput style={styles.input} value={shareTarget} onChangeText={setShareTarget}
            placeholder="共享目标 UUID（level=control）" placeholderTextColor={colors.faint} autoCapitalize="none" />
          <Pressable style={styles.btn} disabled={busy || !shareTarget.trim()}
            onPress={() => void shareAction(false)}>
            <Text style={styles.btnText}>共享</Text>
          </Pressable>
          <Pressable style={styles.btnDanger} disabled={busy || !shareDevice.trim()}
            onPress={() => void shareAction(true)}>
            <Text style={styles.btnText}>取消共享</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.sectionLabel}>AE2 物品查询（me.query，节点执行后回填）</Text>
      <View style={styles.shareRow}>
        <TextInput style={styles.input} value={queryDevice} onChangeText={setQueryDevice}
          placeholder="设备 ID（点上方设备自动填入）" placeholderTextColor={colors.faint} autoCapitalize="none" />
        <Pressable style={styles.btn} disabled={queryBusy || !queryDevice.trim()}
          onPress={() => void runQuery(false)}>
          <Text style={styles.btnText}>发起查询</Text>
        </Pressable>
        <Pressable style={styles.btnOutline} disabled={queryBusy || !queryId}
          onPress={() => void runQuery(true)}>
          <Text style={styles.btnOutlineText}>刷新结果</Text>
        </Pressable>
      </View>
      {queryMsg !== '' && <Text style={styles.queryMsg}>{queryMsg}</Text>}
      {queryItems.map((it, i) => (
        <Text key={i} style={styles.itemRow} numberOfLines={1}>
          {String(it.displayName ?? it.item ?? '未知物品')} × {String(it.count ?? 0)}
        </Text>
      ))}

      {okMsg !== '' && <Text style={styles.ok}>{okMsg}</Text>}
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
  empty: { color: colors.faint, fontSize: 13, marginTop: 10, lineHeight: 20 },
  deviceCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceId: { color: colors.text, fontSize: 13, flex: 1, marginRight: 8 },
  deviceTag: { color: colors.muted, fontSize: 11 },
  sharedText: { color: colors.faint, fontSize: 11, marginTop: 4 },
  pickBtn: { marginTop: 6, alignSelf: 'flex-start' },
  pickText: { color: colors.primaryText, fontSize: 11 },
  shareRow: { flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 12,
  },
  btn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  btnDanger: { borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  btnOutline: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  btnOutlineText: { color: colors.primaryText, fontSize: 12 },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  sectionLabel: { color: colors.faint, fontSize: 11, marginTop: 16 },
  queryMsg: { color: colors.muted, fontSize: 12, marginTop: 6 },
  itemRow: { color: colors.text, fontSize: 12, marginTop: 4 },
  ok: { color: colors.ok, fontSize: 12, marginTop: 8 },
});
