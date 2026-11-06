"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeScreen = MeScreen;
/**
 * ME 设备屏（迁移适配指南 §ItemsScreen 基础，阶段 5）：
 * me.list 跨子服汇总（自有+被共享，含共享明细）+ me.share/unshare 管理。
 * 设备注册来自节点（me.register node op）；无设备时空态即预期。
 * me.query 物品查询依赖节点侧 AE2 执行器，接入后从本屏入口进入。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("./theme");
function MeScreen({ conn, uuid }) {
    const [devices, setDevices] = (0, react_1.useState)([]);
    const [error, setError] = (0, react_1.useState)('');
    const [shareDevice, setShareDevice] = (0, react_1.useState)('');
    const [shareTarget, setShareTarget] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [okMsg, setOkMsg] = (0, react_1.useState)('');
    const load = (0, react_1.useCallback)(async () => {
        setError('');
        try {
            const res = await conn.req('me.list', { uuid });
            if (res.ok && Array.isArray(res.b?.devices)) {
                setDevices(res.b.devices.map((d) => ({
                    deviceId: String(d.deviceId),
                    nodeId: Number(d.nodeId),
                    owner: String(d.owner),
                    kind: String(d.kind ?? 'me'),
                    mine: String(d.owner) === uuid,
                    shared: Array.isArray(d.shared) ? d.shared : [],
                })));
            }
            else {
                setError(res.m ?? 'me.list 失败');
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
    }, [conn, uuid]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    const shareAction = async (unshare) => {
        if (busy || !shareDevice.trim() || (!unshare && !shareTarget.trim()))
            return;
        setBusy(true);
        setError('');
        setOkMsg('');
        try {
            const res = unshare
                ? await conn.req('me.unshare', { uuid, deviceId: shareDevice.trim() })
                : await conn.req('me.share', { uuid, deviceId: shareDevice.trim(), target: shareTarget.trim(), level: 'control' });
            if (res.ok) {
                setOkMsg(unshare ? '已取消共享' : '已共享（control 级）');
                await load();
            }
            else {
                setError(res.m ?? '操作失败');
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
        finally {
            setBusy(false);
        }
    };
    return (<react_native_1.View style={styles.card}>
      <react_native_1.View style={styles.headerRow}>
        <react_native_1.Text style={styles.title}>ME 设备</react_native_1.Text>
        <react_native_1.Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <react_native_1.Text style={styles.refreshText}>刷新</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}
      {devices.length === 0 && error === '' && (<react_native_1.Text style={styles.empty}>
          暂无设备。放置 ME 管理方块并由节点注册后在此显示（阶段 5 设备域）。
        </react_native_1.Text>)}

      {devices.map((d) => (<react_native_1.View key={d.deviceId} style={styles.deviceCard}>
          <react_native_1.View style={styles.deviceHeader}>
            <react_native_1.Text style={styles.deviceId} numberOfLines={1}>{d.deviceId}</react_native_1.Text>
            <react_native_1.Text style={styles.deviceTag}>
              {d.mine ? '自有' : `共享自 ${d.owner}`} · 节点 {d.nodeId} · {d.kind}
            </react_native_1.Text>
          </react_native_1.View>
          {d.shared.length > 0 && (<react_native_1.Text style={styles.sharedText} numberOfLines={2}>
              共享给：{d.shared.map((s) => `${s.uuid}（${s.level}）`).join('，')}
            </react_native_1.Text>)}
          {d.mine && (<react_native_1.Pressable style={styles.pickBtn} onPress={() => setShareDevice(d.deviceId)}>
              <react_native_1.Text style={styles.pickText}>{shareDevice === d.deviceId ? '已选中（下方输入共享目标）' : '选中管理共享'}</react_native_1.Text>
            </react_native_1.Pressable>)}
        </react_native_1.View>))}

      {devices.some((d) => d.mine) && (<react_native_1.View style={styles.shareRow}>
          <react_native_1.TextInput style={styles.input} value={shareTarget} onChangeText={setShareTarget} placeholder="共享目标 UUID（level=control）" placeholderTextColor={theme_1.colors.faint} autoCapitalize="none"/>
          <react_native_1.Pressable style={styles.btn} disabled={busy || !shareTarget.trim()} onPress={() => void shareAction(false)}>
            <react_native_1.Text style={styles.btnText}>共享</react_native_1.Text>
          </react_native_1.Pressable>
          <react_native_1.Pressable style={styles.btnDanger} disabled={busy || !shareDevice.trim()} onPress={() => void shareAction(true)}>
            <react_native_1.Text style={styles.btnText}>取消共享</react_native_1.Text>
          </react_native_1.Pressable>
        </react_native_1.View>)}

      {okMsg !== '' && <react_native_1.Text style={styles.ok}>{okMsg}</react_native_1.Text>}
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: theme_1.colors.text, fontSize: 16, fontWeight: '600' },
    refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: theme_1.colors.primary },
    refreshText: { color: theme_1.colors.primaryText, fontSize: 12 },
    error: { color: theme_1.colors.danger, fontSize: 12, marginTop: 8 },
    empty: { color: theme_1.colors.faint, fontSize: 13, marginTop: 10, lineHeight: 20 },
    deviceCard: {
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 8,
    },
    deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    deviceId: { color: theme_1.colors.text, fontSize: 13, flex: 1, marginRight: 8 },
    deviceTag: { color: theme_1.colors.muted, fontSize: 11 },
    sharedText: { color: theme_1.colors.faint, fontSize: 11, marginTop: 4 },
    pickBtn: { marginTop: 6, alignSelf: 'flex-start' },
    pickText: { color: theme_1.colors.primaryText, fontSize: 11 },
    shareRow: { flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center' },
    input: {
        flex: 1,
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: theme_1.colors.text,
        fontSize: 12,
    },
    btn: { backgroundColor: theme_1.colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
    btnDanger: { borderWidth: 1, borderColor: theme_1.colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
    btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    ok: { color: theme_1.colors.ok, fontSize: 12, marginTop: 8 },
});
