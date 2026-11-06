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
exports.HomeScreen = HomeScreen;
/**
 * 主界面（迁移适配指南 §首屏占位）：连接状态 + 绑定 UUID 列表 + 断开。
 * 队伍/聊天/ME 各屏随逐屏迁移增量接入（guide §逐屏适配清单）。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const TeamScreen_1 = require("./TeamScreen");
const ChatScreen_1 = require("./ChatScreen");
const TeamOpsScreen_1 = require("./TeamOpsScreen");
const TeamRosterScreen_1 = require("./TeamRosterScreen");
const BindScreen_1 = require("./BindScreen");
const MonitorScreen_1 = require("./MonitorScreen");
const SessionScreen_1 = require("./SessionScreen");
const AboutScreen_1 = require("./AboutScreen");
function HomeScreen({ host, port, connected, uuids, conn, onDisconnect, onUuidsChanged }) {
    const [selected, setSelected] = (0, react_1.useState)('');
    const activeUuid = uuids.includes(selected) ? selected : uuids[0];
    return (<react_native_1.View style={styles.card}>
      <react_native_1.Text style={styles.brand}>Horizon</react_native_1.Text>
      <react_native_1.View style={styles.statusRow}>
        <react_native_1.View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]}/>
        <react_native_1.Text style={styles.statusText}>
          {connected ? `已连接 ${host}:${port}` : '连接中断，自动重连中…'}
        </react_native_1.Text>
      </react_native_1.View>

      <react_native_1.Text style={styles.label}>绑定 UUID</react_native_1.Text>
      {uuids.length === 0 ? (conn != null && (<BindScreen_1.BindScreen conn={conn} onBound={(list) => {
                if (list.length > 0)
                    onUuidsChanged(list);
            }}/>)) : (<react_native_1.View>
          {uuids.map((u) => (<react_native_1.Pressable key={u} style={[styles.uuidRow, u === activeUuid && styles.uuidRowActive]} onPress={() => setSelected(u)}>
              <react_native_1.Text style={[styles.uuidText, u === activeUuid && styles.uuidTextActive]}>
                {u}{u === activeUuid ? '  ← 当前' : ''}
              </react_native_1.Text>
            </react_native_1.Pressable>))}
          {conn != null && activeUuid != null && (<>
              <TeamScreen_1.TeamScreen conn={conn} uuid={activeUuid}/>
              <TeamOpsScreen_1.TeamOpsScreen conn={conn} uuid={activeUuid} onChanged={() => undefined}/>
              <TeamRosterScreen_1.TeamRosterScreen conn={conn} uuid={activeUuid}/>
              <ChatScreen_1.ChatScreen conn={conn} uuid={activeUuid}/>
            </>)}
        </react_native_1.View>)}

      {conn != null && <MonitorScreen_1.MonitorScreen conn={conn}/>}
      {conn != null && <SessionScreen_1.SessionScreen conn={conn} onSelfRevoked={onDisconnect}/>}
      <AboutScreen_1.AboutScreen />

      <react_native_1.Pressable style={styles.btn} onPress={onDisconnect}>
        <react_native_1.Text style={styles.btnText}>断开连接</react_native_1.Text>
      </react_native_1.Pressable>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center' },
    brand: { color: '#E8EEF9', fontSize: 30, fontWeight: '700', letterSpacing: 2 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 20 },
    dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
    dotOn: { backgroundColor: '#4CC38A' },
    dotOff: { backgroundColor: '#E4A24C' },
    statusText: { color: '#8FA3C7', fontSize: 13 },
    label: { color: '#8FA3C7', fontSize: 12, marginTop: 14, marginBottom: 6 },
    empty: { color: '#5A6B8C', fontSize: 13, lineHeight: 20 },
    uuidRow: {
        backgroundColor: '#16203A',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 6,
    },
    uuidRowActive: { borderWidth: 1, borderColor: '#2E6BE6' },
    uuidText: { color: '#E8EEF9', fontSize: 13 },
    uuidTextActive: { color: '#6E9BF0' },
    btn: {
        borderRadius: 8,
        paddingVertical: 13,
        alignItems: 'center',
        marginTop: 26,
        borderWidth: 1,
        borderColor: '#E46A6A',
    },
    btnText: { color: '#E46A6A', fontSize: 15, fontWeight: '600' },
});
