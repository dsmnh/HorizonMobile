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
exports.SessionScreen = SessionScreen;
/**
 * 会话管理屏（迁移适配指南 §SettingsScreen 会话域）：列出本账号全部活跃会话并支持撤销。
 * 协议面：account.sessions（current 标记）+ account.revokeSession（契约 §3.5）。
 * 撤销当前会话将触发本端断开（后端 runAfterResponse(conn::close)），上层据此回登录屏。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("../ui/theme");
function SessionScreen({ conn, onSelfRevoked }) {
    const [sessions, setSessions] = (0, react_1.useState)([]);
    const [error, setError] = (0, react_1.useState)('');
    const refresh = (0, react_1.useCallback)(async () => {
        setError('');
        try {
            const res = await conn.req('account.sessions');
            if (res.ok && Array.isArray(res.b?.sessions)) {
                setSessions(res.b.sessions);
            }
            else {
                setError(res.m ?? 'account.sessions 失败');
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
    }, [conn]);
    (0, react_1.useEffect)(() => {
        void refresh();
    }, [refresh]);
    const revoke = async (s) => {
        setError('');
        try {
            const res = await conn.req('account.revokeSession', { id: s.id });
            if (!res.ok) {
                setError(res.m ?? '撤销失败');
                return;
            }
            if (s.current) {
                // 本端会话被撤销：后端会在应答后断开，直接通知上层回登录屏
                onSelfRevoked?.();
            }
            else {
                void refresh();
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
    };
    return (<react_native_1.View style={styles.card}>
      <react_native_1.View style={styles.headerRow}>
        <react_native_1.Text style={styles.title}>会话管理</react_native_1.Text>
        <react_native_1.Pressable style={styles.refreshBtn} onPress={() => void refresh()}>
          <react_native_1.Text style={styles.refreshText}>刷新</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>
      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}
      {sessions.map((s) => (<react_native_1.View key={s.id} style={styles.row}>
          <react_native_1.View style={styles.meta}>
            <react_native_1.Text style={styles.app}>{s.app || '未知客户端'}{s.current ? '（当前）' : ''}</react_native_1.Text>
            <react_native_1.Text style={styles.seen}>最近活跃 {new Date(s.lastSeen * 1000).toLocaleString()}</react_native_1.Text>
          </react_native_1.View>
          <react_native_1.Pressable style={styles.revokeBtn} onPress={() => void revoke(s)}>
            <react_native_1.Text style={styles.revokeText}>撤销</react_native_1.Text>
          </react_native_1.Pressable>
        </react_native_1.View>))}
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: theme_1.colors.text, fontSize: 16, fontWeight: '600' },
    refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: theme_1.colors.primary },
    refreshText: { color: theme_1.colors.primaryText, fontSize: 12 },
    error: { color: theme_1.colors.danger, fontSize: 12, marginTop: 8 },
    row: {
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingVertical: 9,
        paddingHorizontal: 12,
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    meta: { flex: 1, marginRight: 8 },
    app: { color: theme_1.colors.text, fontSize: 14 },
    seen: { color: theme_1.colors.faint, fontSize: 11, marginTop: 2 },
    revokeBtn: { borderWidth: 1, borderColor: theme_1.colors.danger, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    revokeText: { color: theme_1.colors.danger, fontSize: 12 },
});
