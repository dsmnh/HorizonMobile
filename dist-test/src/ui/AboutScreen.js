"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AboutScreen = AboutScreen;
/**
 * 关于屏（迁移适配指南 §AboutScreen）：品牌、协议版本与开源信息（静态）。
 */
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
function AboutScreen() {
    return (<react_native_1.View style={styles.card}>
      <react_native_1.Text style={styles.brand}>Horizon</react_native_1.Text>
      <react_native_1.Text style={styles.sub}>深空矩阵新视野 · GTNH 服务器网络移动端互联生态</react_native_1.Text>
      <react_native_1.Text style={styles.line}>协议契约：HorizonProtocol 1.5.x（App 平面 HMAC 会话 + 订阅流）</react_native_1.Text>
      <react_native_1.Text style={styles.line}>组织：github.com/dsmnh</react_native_1.Text>
      <react_native_1.Text style={styles.line}>App 协议栈：本仓库 src/net（帧编解码 / 签名 / 多路复用连接 / 订阅流）</react_native_1.Text>
      <react_native_1.Text style={styles.line}>底座：Expo 51 · React Native 0.74（自 AEMobileApp 迁移）</react_native_1.Text>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 18 },
    brand: { color: '#E8EEF9', fontSize: 26, fontWeight: '700', letterSpacing: 2 },
    sub: { color: '#5A6B8C', fontSize: 12, marginTop: 4, marginBottom: 14 },
    line: { color: '#8FA3C7', fontSize: 12, marginTop: 6, lineHeight: 18 },
});
