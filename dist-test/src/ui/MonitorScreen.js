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
exports.MonitorScreen = MonitorScreen;
/**
 * 监控屏（迁移适配指南 §MonitorScreen，阶段 6）：metrics.network 5 秒轮询渲染节点帧。
 * 权限：super/owner（契约 1.5.0）；普通账号展示后端的结构化拒绝。
 * MSPT/TPS 由服务端 TickMonitor 5s 窗口采集（HorizonModServer）。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("../ui/theme");
function MonitorScreen({ conn }) {
    const [nodes, setNodes] = (0, react_1.useState)([]);
    const [error, setError] = (0, react_1.useState)('');
    const [polling, setPolling] = (0, react_1.useState)(true);
    const timerRef = (0, react_1.useRef)(null);
    const refresh = (0, react_1.useCallback)(async () => {
        setError('');
        try {
            const res = await conn.req('metrics.network', {});
            if (res.ok && Array.isArray(res.b?.nodes)) {
                setNodes(res.b.nodes);
            }
            else {
                setError(res.m ?? 'metrics.network 失败（需要 super/owner 账号）');
                setNodes([]);
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
    }, [conn]);
    (0, react_1.useEffect)(() => {
        void refresh();
        if (polling) {
            timerRef.current = setInterval(() => void refresh(), 5000);
        }
        return () => {
            if (timerRef.current)
                clearInterval(timerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conn, polling]);
    return (<react_native_1.View style={styles.card}>
      <react_native_1.View style={styles.headerRow}>
        <react_native_1.Text style={styles.title}>网络监控</react_native_1.Text>
        <react_native_1.Pressable style={styles.toggleBtn} onPress={() => setPolling((v) => !v)}>
          <react_native_1.Text style={styles.toggleText}>{polling ? '暂停轮询' : '恢复轮询'}</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}
      {nodes.length === 0 && error === '' && <react_native_1.Text style={styles.empty}>网络内暂无活跃节点。</react_native_1.Text>}

      {nodes.map((n) => (<react_native_1.View key={n.nodeId} style={styles.nodeCard}>
          <react_native_1.View style={styles.nodeHeader}>
            <react_native_1.Text style={styles.nodeName}>{n.name ?? `节点 ${n.nodeId}`}</react_native_1.Text>
            {n.offline || !n.frame ? (<react_native_1.Text style={styles.offline}>离线/无帧</react_native_1.Text>) : (<react_native_1.Text style={styles.online}>在线</react_native_1.Text>)}
          </react_native_1.View>
          {n.frame && !n.offline && (<>
              <react_native_1.Text style={styles.metrics}>
                TPS {n.frame.tps.toFixed(1)} ｜ MSPT {n.frame.mspt.toFixed(1)}
                {n.frame.max != null ? `（峰值 ${n.frame.max.toFixed(1)}）` : ''} ｜ 玩家 {n.frame.players}
              </react_native_1.Text>
              {(n.frame.dims ?? []).filter((d) => d.players > 0).map((d) => (<react_native_1.Text key={d.id} style={styles.dim}>
                  维度 {d.id}：{d.players} 人，MSPT {d.mspt.toFixed(2)}
                </react_native_1.Text>))}
            </>)}
        </react_native_1.View>))}
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 18 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: theme_1.colors.text, fontSize: 16, fontWeight: '600' },
    toggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: theme_1.colors.primary },
    toggleText: { color: theme_1.colors.primaryText, fontSize: 12 },
    error: { color: theme_1.colors.danger, fontSize: 13, marginTop: 8 },
    empty: { color: theme_1.colors.faint, fontSize: 13, marginTop: 10 },
    nodeCard: {
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 8,
    },
    nodeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    nodeName: { color: theme_1.colors.text, fontSize: 15 },
    online: { color: theme_1.colors.ok, fontSize: 12 },
    offline: { color: theme_1.colors.warn, fontSize: 12 },
    metrics: { color: theme_1.colors.muted, fontSize: 13, marginTop: 6 },
    dim: { color: theme_1.colors.faint, fontSize: 11, marginTop: 3 },
});
