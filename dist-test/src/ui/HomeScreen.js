"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeScreen = HomeScreen;
/**
 * 主界面（迁移适配指南 §首屏占位）：连接状态 + 绑定 UUID 列表 + 断开。
 * 队伍/聊天/ME 各屏随逐屏迁移增量接入（guide §逐屏适配清单）。
 */
const react_1 = __importDefault(require("react"));
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
          {uuids.map((u) => (<react_native_1.View key={u} style={styles.uuidRow}>
              <react_native_1.Text style={styles.uuidText}>{u}</react_native_1.Text>
            </react_native_1.View>))}
          {conn != null && (<>
              <TeamScreen_1.TeamScreen conn={conn} uuid={uuids[0]}/>
              <TeamOpsScreen_1.TeamOpsScreen conn={conn} uuid={uuids[0]} onChanged={() => undefined}/>
              <TeamRosterScreen_1.TeamRosterScreen conn={conn} uuid={uuids[0]}/>
              <ChatScreen_1.ChatScreen conn={conn} uuid={uuids[0]}/>
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
    uuidText: { color: '#E8EEF9', fontSize: 13 },
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
