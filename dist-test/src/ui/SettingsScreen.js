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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsScreen = SettingsScreen;
/**
 * 设置屏（迁移适配指南 §SettingsScreen）：本地偏好与缓存管理。
 * 协议无关（guide 定性「本地设置保留」）：当前提供上次连接信息清除；监控轮询开关在监控屏内。
 * 主题切换随主题系统增量扩展（src/ui/theme.ts palette）。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const theme_1 = require("./theme");
function SettingsScreen() {
    const [msg, setMsg] = (0, react_1.useState)('');
    const clearConn = async () => {
        try {
            await async_storage_1.default.removeItem('horizon.conn.last');
            setMsg('已清除上次连接信息');
        }
        catch {
            setMsg('清除失败（存储不可用）');
        }
    };
    return (<react_native_1.View style={styles.card}>
      <react_native_1.Text style={styles.title}>设置</react_native_1.Text>
      <react_native_1.Pressable style={styles.btn} onPress={() => void clearConn()}>
        <react_native_1.Text style={styles.btnText}>清除上次连接信息</react_native_1.Text>
      </react_native_1.Pressable>
      {msg !== '' && <react_native_1.Text style={styles.ok}>{msg}</react_native_1.Text>}
      <react_native_1.Text style={styles.note}>
        监控轮询开关位于监控屏；主题基线为深空矩阵配色（src/ui/theme.ts），换肤随增量扩展。
      </react_native_1.Text>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
    title: { color: theme_1.colors.text, fontSize: 16, fontWeight: '600' },
    btn: {
        borderWidth: 1,
        borderColor: theme_1.colors.danger,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 12,
    },
    btnText: { color: theme_1.colors.danger, fontSize: 14, fontWeight: '600' },
    ok: { color: theme_1.colors.ok, fontSize: 12, marginTop: 8 },
    note: { color: theme_1.colors.faint, fontSize: 12, marginTop: 12, lineHeight: 18 },
});
