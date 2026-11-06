/**
 * 关于屏（迁移适配指南 §AboutScreen）：品牌、协议版本与开源信息（静态）。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../ui/theme';

export function AboutScreen(): JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.brand}>Horizon</Text>
      <Text style={styles.sub}>深空矩阵新视野 · GTNH 服务器网络移动端互联生态</Text>
      <Text style={styles.line}>协议契约：HorizonProtocol 1.5.x（App 平面 HMAC 会话 + 订阅流）</Text>
      <Text style={styles.line}>组织：github.com/dsmnh</Text>
      <Text style={styles.line}>App 协议栈：本仓库 src/net（帧编解码 / 签名 / 多路复用连接 / 订阅流）</Text>
      <Text style={styles.line}>底座：Expo 51 · React Native 0.74（自 AEMobileApp 迁移）</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 18 },
  brand: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: 2 },
  sub: { color: colors.faint, fontSize: 12, marginTop: 4, marginBottom: 14 },
  line: { color: colors.muted, fontSize: 12, marginTop: 6, lineHeight: 18 },
});
