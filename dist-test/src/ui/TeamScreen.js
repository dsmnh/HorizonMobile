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
exports.TeamScreen = TeamScreen;
/**
 * 队伍屏（迁移适配指南 §阶段 2）：绑定 UUID 的队伍列表与实时事件流。
 * 协议面：team.list（REQ）+ subscribeTeam（SUB，契约 1.2.0 sid/seq 语义）。
 * 队伍操作（create/invite/…）随下一迁移增量接入。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("./theme");
function TeamScreen({ conn, uuid }) {
    const [teams, setTeams] = (0, react_1.useState)([]);
    const [error, setError] = (0, react_1.useState)('');
    const [lastEvent, setLastEvent] = (0, react_1.useState)(null);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    const streamRef = (0, react_1.useRef)(null);
    const refresh = (0, react_1.useCallback)(async () => {
        setRefreshing(true);
        setError('');
        try {
            const res = await conn.req('team.list', { uuid });
            if (res.ok && Array.isArray(res.b?.teams)) {
                setTeams(res.b.teams);
            }
            else {
                setError(res.m ?? 'team.list 失败');
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
        finally {
            setRefreshing(false);
        }
    }, [conn, uuid]);
    // 订阅 team 流：事件仅刷新提示（增量语义按契约 §6，合并逻辑随队伍操作屏接入）
    (0, react_1.useEffect)(() => {
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
    return (<react_native_1.View style={styles.card}>
      <react_native_1.View style={styles.headerRow}>
        <react_native_1.Text style={styles.title}>队伍</react_native_1.Text>
        <react_native_1.Pressable style={styles.refreshBtn} disabled={refreshing} onPress={() => void refresh()}>
          <react_native_1.Text style={styles.refreshText}>{refreshing ? '刷新中…' : '刷新'}</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      {lastEvent != null && (<react_native_1.Text style={styles.event} numberOfLines={1}>
          实时：{lastEvent.k}（seq {lastEvent.seq}）
        </react_native_1.Text>)}

      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}

      {teams.length === 0 && error === '' && (<react_native_1.Text style={styles.empty}>尚未加入任何队伍。</react_native_1.Text>)}

      {teams.map((t) => (<react_native_1.View key={t.teamId} style={styles.row}>
          <react_native_1.Text style={styles.teamName}>{t.name}</react_native_1.Text>
          <react_native_1.Text style={styles.teamMeta}>
            {t.memberCount} 人 · {t.joinMode === 'open' ? '公开' : '邀请制'}
          </react_native_1.Text>
        </react_native_1.View>))}
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: theme_1.colors.text, fontSize: 22, fontWeight: '700' },
    refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: theme_1.colors.primary },
    refreshText: { color: theme_1.colors.primaryText, fontSize: 12 },
    event: { color: theme_1.colors.ok, fontSize: 12, marginTop: 8 },
    error: { color: theme_1.colors.danger, fontSize: 13, marginTop: 10 },
    empty: { color: theme_1.colors.faint, fontSize: 13, marginTop: 10 },
    row: {
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    teamName: { color: theme_1.colors.text, fontSize: 15 },
    teamMeta: { color: theme_1.colors.muted, fontSize: 12 },
});
