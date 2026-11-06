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
exports.LoginScreen = LoginScreen;
/**
 * 登录/注册屏（迁移适配指南 §SetupScreen）：后端地址 + 账号密码 + 双动作。
 * 协议面：预鉴权 account.login / account.register（src/net/preauth.ts）。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("./theme");
const lastConn_1 = require("./lastConn");
function LoginScreen({ onAuthenticate, busy, error }) {
    const [host, setHost] = (0, react_1.useState)('');
    const [port, setPort] = (0, react_1.useState)('');
    const [name, setName] = (0, react_1.useState)('');
    const [pass, setPass] = (0, react_1.useState)('');
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    // 上次成功连接的地址与账号名预填（AsyncStorage；失败保持空表单）
    (0, react_1.useEffect)(() => {
        void (0, lastConn_1.loadLastConn)().then((last) => {
            if (last) {
                setHost(last.host);
                setPort(String(last.port));
                setName(last.name);
            }
            setLoaded(true);
        });
    }, []);
    const submit = (mode) => {
        const p = parseInt(port, 10);
        if (!host || !p || !name || !pass) {
            return;
        }
        void onAuthenticate(host, p, mode, name, pass);
    };
    if (!loaded) {
        return <react_native_1.View style={styles.card}/>;
    }
    return (<react_native_1.View style={styles.card}>
      <react_native_1.Text style={styles.brand}>Horizon</react_native_1.Text>
      <react_native_1.Text style={styles.subtitle}>深空矩阵新视野 · 移动端</react_native_1.Text>

      <react_native_1.Text style={styles.label}>后端地址</react_native_1.Text>
      <react_native_1.View style={styles.row}>
        <react_native_1.TextInput style={[styles.input, styles.hostInput]} value={host} onChangeText={setHost} placeholder="192.168.x.x" placeholderTextColor="#5A6B8C" autoCapitalize="none" editable={!busy}/>
        <react_native_1.TextInput style={styles.portInput} value={port} onChangeText={setPort} keyboardType="number-pad" editable={!busy}/>
      </react_native_1.View>

      <react_native_1.Text style={styles.label}>账号</react_native_1.Text>
      <react_native_1.TextInput style={styles.input} value={name} onChangeText={setName} autoCapitalize="none" editable={!busy}/>

      <react_native_1.Text style={styles.label}>密码</react_native_1.Text>
      <react_native_1.TextInput style={styles.input} value={pass} onChangeText={setPass} secureTextEntry editable={!busy}/>

      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}

      <react_native_1.Pressable style={[styles.btn, styles.primary, busy && styles.disabled]} disabled={busy} onPress={() => submit('login')}>
        <react_native_1.Text style={styles.btnText}>登录</react_native_1.Text>
      </react_native_1.Pressable>
      <react_native_1.Pressable style={[styles.btn, styles.secondary, busy && styles.disabled]} disabled={busy} onPress={() => submit('register')}>
        <react_native_1.Text style={[styles.btnText, styles.secondaryText]}>注册新账号</react_native_1.Text>
      </react_native_1.Pressable>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center' },
    brand: { color: theme_1.colors.text, fontSize: 34, fontWeight: '700', letterSpacing: 2 },
    subtitle: { color: theme_1.colors.faint, fontSize: 13, marginBottom: 28 },
    label: { color: theme_1.colors.muted, fontSize: 12, marginTop: 14, marginBottom: 6 },
    row: { flexDirection: 'row', gap: 8 },
    input: {
        flex: 1,
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: theme_1.colors.text,
        fontSize: 15,
    },
    hostInput: {},
    portInput: {
        width: 90,
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: theme_1.colors.text,
        fontSize: 15,
    },
    error: { color: theme_1.colors.danger, fontSize: 13, marginTop: 12 },
    btn: {
        borderRadius: 8,
        paddingVertical: 13,
        alignItems: 'center',
        marginTop: 14,
    },
    primary: { backgroundColor: theme_1.colors.primary },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme_1.colors.primary },
    disabled: { opacity: 0.5 },
    btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    secondaryText: { color: theme_1.colors.primaryText },
});
