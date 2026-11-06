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
exports.LoginRoute = LoginRoute;
exports.HomeRoute = HomeRoute;
exports.TeamRoute = TeamRoute;
exports.ChatRoute = ChatRoute;
exports.MonitorRoute = MonitorRoute;
exports.SessionRoute = SessionRoute;
/**
 * 路由包装层：从 AppContext 取值下传给既有屏幕组件（屏幕保持 props 无感）。
 * LoginRoute 在鉴权成功后跳 Home；各功能屏自行处理未连接回退。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("./theme");
const nav_1 = require("./nav");
const LoginScreen_1 = require("./LoginScreen");
const TeamScreen_1 = require("./TeamScreen");
const TeamOpsScreen_1 = require("./TeamOpsScreen");
const TeamRosterScreen_1 = require("./TeamRosterScreen");
const ChatScreen_1 = require("./ChatScreen");
const MonitorScreen_1 = require("./MonitorScreen");
const SessionScreen_1 = require("./SessionScreen");
const BindScreen_1 = require("./BindScreen");
const AboutScreen_1 = require("./AboutScreen");
function LoginRoute({ navigation }) {
    const { authenticate, busy, error, conn } = (0, nav_1.useApp)();
    // 鉴权成功（conn 就位）即进入主界面
    react_1.default.useEffect(() => {
        if (conn) {
            navigation.replace('Home');
        }
    }, [conn, navigation]);
    return (<react_native_1.SafeAreaView style={styles.root}>
      <react_native_1.ScrollView contentContainerStyle={styles.body}>
        <LoginScreen_1.LoginScreen onAuthenticate={authenticate} busy={busy} error={error}/>
      </react_native_1.ScrollView>
    </react_native_1.SafeAreaView>);
}
function HomeRoute({ navigation }) {
    const { conn, connected, uuids, setUuids, disconnect } = (0, nav_1.useApp)();
    const [selected, setSelected] = (0, react_1.useState)('');
    // 会话被撤销/断开：回登录屏
    react_1.default.useEffect(() => {
        if (!conn) {
            navigation.replace('Login');
        }
    }, [conn, navigation]);
    const activeUuid = uuids.includes(selected) ? selected : uuids[0];
    const menu = [
        { label: '队伍', route: 'Team' },
        { label: '聊天', route: 'Chat' },
        { label: '监控', route: 'Monitor' },
        { label: '会话', route: 'Session' },
    ];
    return (<react_native_1.SafeAreaView style={styles.root}>
      <react_native_1.ScrollView contentContainerStyle={styles.body}>
        <react_native_1.View style={styles.statusRow}>
          <react_native_1.View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]}/>
          <react_native_1.Text style={styles.statusText}>{connected ? '已连接' : '连接中断，自动重连中…'}</react_native_1.Text>
        </react_native_1.View>

        {uuids.length === 0 ? (conn != null && (<BindScreen_1.BindScreen conn={conn} onBound={(list) => {
                if (list.length > 0)
                    setUuids(list);
            }}/>)) : (<react_native_1.View>
            <react_native_1.Text style={styles.sectionLabel}>绑定身份</react_native_1.Text>
            {uuids.map((u) => (<react_native_1.Pressable key={u} style={[styles.uuidRow, u === activeUuid && styles.uuidRowActive]} onPress={() => setSelected(u)}>
                <react_native_1.Text style={[styles.uuidText, u === activeUuid && styles.uuidTextActive]}>
                  {u}{u === activeUuid ? '  ← 当前' : ''}
                </react_native_1.Text>
              </react_native_1.Pressable>))}
            <react_native_1.View style={styles.menuRow}>
              {menu.map((m) => (<react_native_1.Pressable key={m.route} style={styles.menuBtn} onPress={() => navigation.navigate(m.route)}>
                  <react_native_1.Text style={styles.menuBtnText}>{m.label}</react_native_1.Text>
                </react_native_1.Pressable>))}
            </react_native_1.View>
          </react_native_1.View>)}

        {conn != null && uuids.length === 0 && <MonitorScreen_1.MonitorScreen conn={conn}/>}
        <react_native_1.Pressable style={styles.disconnectBtn} onPress={disconnect}>
          <react_native_1.Text style={styles.disconnectText}>断开连接</react_native_1.Text>
        </react_native_1.Pressable>
        <AboutScreen_1.AboutScreen />
        <react_native_1.Text style={styles.footer}>Horizon · 协议 1.5.x · 会话经 HMAC 鉴权</react_native_1.Text>
      </react_native_1.ScrollView>
    </react_native_1.SafeAreaView>);
}
function TeamRoute() {
    const { conn, uuids } = (0, nav_1.useApp)();
    const [selected, setSelected] = (0, react_1.useState)('');
    const activeUuid = uuids.includes(selected) ? selected : uuids[0];
    return (<react_native_1.SafeAreaView style={styles.root}>
      <react_native_1.ScrollView contentContainerStyle={styles.body}>
        {conn != null && activeUuid != null ? (<>
            <TeamScreen_1.TeamScreen conn={conn} uuid={activeUuid}/>
            <TeamOpsScreen_1.TeamOpsScreen conn={conn} uuid={activeUuid} onChanged={() => undefined}/>
            <TeamRosterScreen_1.TeamRosterScreen conn={conn} uuid={activeUuid}/>
          </>) : (<react_native_1.Text style={styles.empty}>未绑定身份：先在主界面完成绑定。</react_native_1.Text>)}
      </react_native_1.ScrollView>
    </react_native_1.SafeAreaView>);
}
function ChatRoute() {
    const { conn, uuids } = (0, nav_1.useApp)();
    const activeUuid = uuids[0];
    return (<react_native_1.SafeAreaView style={styles.root}>
      {conn != null && activeUuid != null ? (<ChatScreen_1.ChatScreen conn={conn} uuid={activeUuid}/>) : (<react_native_1.Text style={styles.empty}>未绑定身份：先在主界面完成绑定。</react_native_1.Text>)}
    </react_native_1.SafeAreaView>);
}
function MonitorRoute() {
    const { conn } = (0, nav_1.useApp)();
    return (<react_native_1.SafeAreaView style={styles.root}>
      <react_native_1.ScrollView contentContainerStyle={styles.body}>
        {conn != null ? <MonitorScreen_1.MonitorScreen conn={conn}/> : <react_native_1.Text style={styles.empty}>未连接。</react_native_1.Text>}
      </react_native_1.ScrollView>
    </react_native_1.SafeAreaView>);
}
function SessionRoute() {
    const { conn, disconnect } = (0, nav_1.useApp)();
    return (<react_native_1.SafeAreaView style={styles.root}>
      <react_native_1.ScrollView contentContainerStyle={styles.body}>
        {conn != null ? (<SessionScreen_1.SessionScreen conn={conn} onSelfRevoked={disconnect}/>) : (<react_native_1.Text style={styles.empty}>未连接。</react_native_1.Text>)}
      </react_native_1.ScrollView>
    </react_native_1.SafeAreaView>);
}
const styles = react_native_1.StyleSheet.create({
    root: { flex: 1, backgroundColor: theme_1.colors.bg },
    body: { flexGrow: 1, padding: 16 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
    dotOn: { backgroundColor: theme_1.colors.ok },
    dotOff: { backgroundColor: theme_1.colors.warn },
    statusText: { color: theme_1.colors.muted, fontSize: 13 },
    sectionLabel: { color: theme_1.colors.faint, fontSize: 12, marginTop: 6, marginBottom: 4 },
    uuidRow: {
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 6,
    },
    uuidRowActive: { borderWidth: 1, borderColor: theme_1.colors.primary },
    uuidText: { color: theme_1.colors.text, fontSize: 13 },
    uuidTextActive: { color: theme_1.colors.primaryText },
    menuRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    menuBtn: {
        flex: 1,
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    menuBtnText: { color: theme_1.colors.primaryText, fontSize: 14, fontWeight: '600' },
    disconnectBtn: {
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 18,
        borderWidth: 1,
        borderColor: theme_1.colors.danger,
    },
    disconnectText: { color: theme_1.colors.danger, fontSize: 14, fontWeight: '600' },
    footer: { color: theme_1.colors.faint, fontSize: 11, textAlign: 'center', marginTop: 14 },
    empty: { color: theme_1.colors.faint, fontSize: 13, marginTop: 20 },
});
