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
exports.TeamOpsScreen = TeamOpsScreen;
/**
 * 队伍操作屏（迁移适配指南 §TeamScreen 操作子集）：常用队伍域 REQ 动作。
 * 覆盖 create/info/leave/disband/joinmode；invite/apply/setrole 等需要目标输入的
 * 动作随下一迁移增量（游戏内命令在 /dsmnhmobile team 子命令全量可用）。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
function TeamOpsScreen({ conn, uuid, onChanged }) {
    const [name, setName] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    const [okMsg, setOkMsg] = (0, react_1.useState)('');
    const run = async (op, p, doneText) => {
        if (busy)
            return;
        setBusy(true);
        setError('');
        setOkMsg('');
        try {
            const res = await conn.req(op, { uuid, ...p });
            if (res.ok) {
                setOkMsg(doneText);
                onChanged?.();
            }
            else {
                setError(`${op}: ${res.m ?? '失败'}`);
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
      <react_native_1.Text style={styles.title}>队伍操作</react_native_1.Text>
      <react_native_1.View style={styles.row}>
        <react_native_1.TextInput style={styles.input} value={name} onChangeText={setName} placeholder="新队伍名" placeholderTextColor="#5A6B8C" editable={!busy}/>
        <react_native_1.Pressable style={[styles.btn, busy && styles.disabled]} disabled={busy} onPress={() => void run('team.create', { name: name.trim() }, '已创建')}>
          <react_native_1.Text style={styles.btnText}>创建</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      <react_native_1.View style={styles.row}>
        <react_native_1.Pressable style={[styles.btn2, busy && styles.disabled]} disabled={busy} onPress={() => void run('team.info', {}, '详情已显示于列表')}>
          <react_native_1.Text style={styles.btn2Text}>info</react_native_1.Text>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={[styles.btn2, busy && styles.disabled]} disabled={busy} onPress={() => void run('team.leave', {}, '已退出')}>
          <react_native_1.Text style={styles.btn2Text}>leave</react_native_1.Text>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={[styles.btn2Danger, busy && styles.disabled]} disabled={busy} onPress={() => void run('team.disband', {}, '已解散')}>
          <react_native_1.Text style={styles.btn2Text}>disband</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      <react_native_1.View style={styles.row}>
        <react_native_1.Text style={styles.joinLabel}>加入方式：</react_native_1.Text>
        <react_native_1.Pressable style={[styles.btn2, busy && styles.disabled]} disabled={busy} onPress={() => void run('team.setJoinMode', { mode: 'open' }, '已切换公开')}>
          <react_native_1.Text style={styles.btn2Text}>open</react_native_1.Text>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={[styles.btn2, busy && styles.disabled]} disabled={busy} onPress={() => void run('team.setJoinMode', { mode: 'invite' }, '已切换邀请制')}>
          <react_native_1.Text style={styles.btn2Text}>invite</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}
      {okMsg !== '' && <react_native_1.Text style={styles.ok}>{okMsg}</react_native_1.Text>}
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
    title: { color: '#E8EEF9', fontSize: 16, fontWeight: '600' },
    row: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
    input: {
        flex: 1,
        backgroundColor: '#16203A',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        color: '#E8EEF9',
        fontSize: 14,
    },
    btn: {
        backgroundColor: '#2E6BE6',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    btn2: {
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#2E6BE6',
    },
    btn2Danger: {
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#E46A6A',
    },
    btn2Text: { color: '#6E9BF0', fontSize: 13 },
    joinLabel: { color: '#8FA3C7', fontSize: 12 },
    btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    disabled: { opacity: 0.5 },
    error: { color: '#E46A6A', fontSize: 12, marginTop: 8 },
    ok: { color: '#4CC38A', fontSize: 12, marginTop: 8 },
});
