/**
 * 关于屏（迁移适配指南 §AboutScreen）：品牌、协议版本与开源信息（静态）。
 * 视觉对齐 AEMobileApp：品牌卡 + 信息分组行。
 */
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, spacing, themedStyles } from './theme';
import { Card, Chip, SectionLabel, SettingsGroup, SettingsRow } from './components';

export function AboutScreen(): JSX.Element {
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <Text style={styles.brand}>Horizon</Text>
        <Text style={styles.sub}>深空矩阵新视野</Text>
        <View style={{ marginTop: spacing.m }}>
          <Chip label="协议 1.6.4" tone="accent" icon="git-branch-outline" />
        </View>
      </Card>

      <SectionLabel text="项目信息" />
      <SettingsGroup>
        <SettingsRow icon="globe-outline" label="组织" value="github.com/dsmnh" />
        <SettingsRow icon="document-text-outline" label="协议契约"
          detail="App 平面 HMAC 会话 + 订阅流" value="HorizonProtocol 1.6.4" />
        <SettingsRow icon="layers-outline" label="协议栈" detail="帧编解码 / 签名 / 多路复用 / 订阅流" value="src/net" />
        <SettingsRow icon="phone-portrait-outline" label="底座" detail="自 AEMobileApp 迁移" value="Expo 51 · RN 0.74" divider={false} />
      </SettingsGroup>

      <Text style={styles.footer}>GTNH 服务器网络移动端互联生态</Text>
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m },
  brand: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: 3 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: spacing.xs },
  footer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.xl },
}));
