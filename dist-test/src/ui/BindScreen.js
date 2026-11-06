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
exports.BindScreen = BindScreen;
/**
 * 绑定管理屏（迁移适配指南 §阶段 1 流程）：输入游戏内 /dsmnhmobile bind 出的绑定码，
 * 调 account.bindUUID 绑定游戏 UUID；成功后回调上层刷新 uuid 列表。
 * 绑定码 10 分钟有效且一次性、新码注销旧码（企划书 03）。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("../ui/theme");
function BindScreen({ conn, onBound }) {
    const [code, setCode] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    const [ok, setOk] = (0, react_1.useState)('');
    const submit = async () => {
        const c = code.trim();
        if (!c || busy)
            return;
        setBusy(true);
        setError('');
        setOk('');
        try {
            const res = await conn.req('account.bindUUID', { code: c });
            if (res.ok) {
                const uuids = Array.isArray(res.b?.uuids) ? res.b.uuids : (res.b?.uuid ? [res.b.uuid] : []);
                setOk('绑定成功');
                setCode('');
                onBound(uuids);
            }
            else {
                setError(res.m ?? '绑定失败');
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
      <react_native_1.Text style={styles.title}>绑定游戏 UUID</react_native_1.Text>
      <react_native_1.Text style={styles.hint}>
        进游戏执行 /dsmnhmobile bind 获取绑定码（10 分钟内有效，仅一次）。
      </react_native_1.Text>
      <react_native_1.View style={styles.row}>
        <react_native_1.TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="绑定码" placeholderTextColor="#5A6B8C" autoCapitalize="characters" editable={!busy}/>
        <react_native_1.Pressable style={[styles.btn, busy && styles.disabled]} disabled={busy} onPress={() => void submit()}>
          <react_native_1.Text style={styles.btnText}>绑定</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>
      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}
      {ok !== '' && <react_native_1.Text style={styles.ok}>{ok}</react_native_1.Text>}
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 18 },
    title: { color: theme_1.colors.text, fontSize: 16, fontWeight: '600' },
    hint: { color: theme_1.colors.faint, fontSize: 12, marginTop: 4, lineHeight: 18 },
    row: { flexDirection: 'row', gap: 8, marginTop: 10 },
    input: {
        flex: 1,
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: theme_1.colors.text,
        fontSize: 15,
    },
    btn: {
        backgroundColor: theme_1.colors.primary,
        borderRadius: 8,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    disabled: { opacity: 0.5 },
    error: { color: theme_1.colors.danger, fontSize: 13, marginTop: 8 },
    ok: { color: theme_1.colors.ok, fontSize: 13, marginTop: 8 },
});
