/**
 * 路由包装层：从 AppContext 取值下传给既有屏幕组件（屏幕保持 props 无感）。
 * LoginRoute 在鉴权成功后跳 Home；各功能屏自行处理未连接回退。
 *
 * 视觉基线对齐 AEMobileApp：主页为「状态条 + 身份卡 + 功能磁贴」的仪表盘结构，
 * 所有颜色取自 theme 的调色板，随深/浅色切换重建。
 */
import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, themedStyles, useTheme } from './theme';
import { useApp, type RootStackProps } from './nav';
import { Card, Chip, EmptyState, GhostButton, PrimaryButton, SectionLabel, StatusDot } from './components';
import { LoginScreen } from './LoginScreen';
import { TeamScreen } from './TeamScreen';
import { TeamOpsScreen } from './TeamOpsScreen';
import { TeamRosterScreen } from './TeamRosterScreen';
import { ChatScreen } from './ChatScreen';
import { MonitorScreen } from './MonitorScreen';
import { MeScreen } from './MeScreen';
import { BqScreen } from './BqScreen';
import { SettingsScreen } from './SettingsScreen';
import { SessionScreen } from './SessionScreen';
import { BindScreen } from './BindScreen';
import { AboutScreen } from './AboutScreen';

/** 主页功能磁贴：图标 + 标题 + 一句话说明。 */
const TILES: {
  route: 'Team' | 'Chat' | 'Monitor' | 'Session' | 'Me' | 'Bq' | 'Settings';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint: string;
}[] = [
  { route: 'Team', label: '队伍', icon: 'people', hint: '成员与邀请' },
  { route: 'Chat', label: '聊天', icon: 'chatbubbles', hint: '公聊与私聊' },
  { route: 'Monitor', label: '监控', icon: 'pulse', hint: '榜单与节点' },
  { route: 'Session', label: '会话', icon: 'shield-checkmark', hint: '登录设备' },
  { route: 'Me', label: 'ME 设备', icon: 'hardware-chip', hint: '网格与共享' },
  { route: 'Bq', label: 'BQ 同步', icon: 'swap-horizontal', hint: '跨服任务' },
  { route: 'Settings', label: '设置', icon: 'settings', hint: '证书与主题' },
];

export function LoginRoute({ navigation }: RootStackProps<'Login'>): JSX.Element {
  const { authenticate, resetPassword, busy, error, conn } = useApp();
  // 鉴权成功（conn 就位）即进入主界面
  React.useEffect(() => {
    if (conn) {
      navigation.replace('Home');
    }
  }, [conn, navigation]);
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <LoginScreen onAuthenticate={authenticate} onResetPassword={resetPassword} busy={busy} error={error} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function HomeRoute({ navigation }: RootStackProps<'Home'>): JSX.Element {
  const { conn, connected, uuids, setUuids, disconnect } = useApp();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string>('');

  // 会话被撤销/断开：回登录屏
  React.useEffect(() => {
    if (!conn) {
      navigation.replace('Login');
    }
  }, [conn, navigation]);

  const activeUuid = uuids.includes(selected) ? selected : uuids[0];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Horizon</Text>
            <Text style={styles.brandSub}>深空矩阵新视野 · 移动端</Text>
          </View>
          <View style={styles.statusPill}>
            <StatusDot ok={connected} />
            <Text style={styles.statusText}>{connected ? '已连接' : '重连中…'}</Text>
          </View>
        </View>

        {uuids.length === 0 ? (
          conn != null ? (
            <BindScreen
              conn={conn}
              onBound={(list) => {
                if (list.length > 0) setUuids(list);
              }}
            />
          ) : (
            <EmptyState icon="link-outline" title="尚未连接" subtitle="返回登录页建立会话" />
          )
        ) : (
          <>
            <SectionLabel text="绑定身份" right={<Text style={styles.count}>{uuids.length} 个</Text>} />
            <Card style={{ padding: 0 }}>
              {uuids.map((u, i) => {
                const on = u === activeUuid;
                return (
                  <Pressable
                    key={u}
                    onPress={() => setSelected(u)}
                    style={[
                      styles.idRow,
                      i < uuids.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={[styles.idIcon, { backgroundColor: on ? colors.accentSoft : colors.surfaceAlt }]}>
                      <Ionicons name="person" size={15} color={on ? colors.accent : colors.textFaint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.idText, on && { color: colors.accent }]} numberOfLines={1}>{u}</Text>
                      <Text style={styles.idHint}>{on ? '当前操作身份' : '点按切换'}</Text>
                    </View>
                    {on ? <Chip label="当前" tone="accent" /> : null}
                  </Pressable>
                );
              })}
            </Card>

            <SectionLabel text="功能" />
            <View style={styles.tiles}>
              {TILES.map((t) => (
                <Pressable
                  key={t.route}
                  onPress={() => navigation.navigate(t.route)}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <View style={[styles.tileIcon, { backgroundColor: colors.accentSoft }]}>
                    <Ionicons name={t.icon} size={17} color={colors.accent} />
                  </View>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                  <Text style={styles.tileHint} numberOfLines={1}>{t.hint}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <GhostButton label="断开连接" icon="log-out-outline" tone="bad" onPress={disconnect} />
            </View>
          </>
        )}

        {conn != null && uuids.length === 0 && <MonitorScreen conn={conn} />}

        <AboutScreen />
        <Text style={styles.footer}>Horizon · 协议 1.6.4 · 会话经 HMAC 鉴权</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export function TeamRoute(): JSX.Element {
  const { conn, uuids } = useApp();
  const [selected, setSelected] = useState<string>('');
  const activeUuid = uuids.includes(selected) ? selected : uuids[0];
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {conn != null && activeUuid != null ? (
          <>
            <TeamScreen conn={conn} uuid={activeUuid} />
            <TeamOpsScreen conn={conn} uuid={activeUuid} onChanged={() => undefined} />
            <TeamRosterScreen conn={conn} uuid={activeUuid} />
          </>
        ) : (
          <EmptyState icon="people-outline" title="未绑定身份" subtitle="先在主界面完成绑定" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ChatRoute(): JSX.Element {
  const { conn, uuids } = useApp();
  const activeUuid = uuids[0];
  return (
    <SafeAreaView style={styles.root}>
      {conn != null && activeUuid != null ? (
        <ChatScreen conn={conn} uuid={activeUuid} />
      ) : (
        <View style={styles.body}>
          <EmptyState icon="chatbubbles-outline" title="未绑定身份" subtitle="先在主界面完成绑定" />
        </View>
      )}
    </SafeAreaView>
  );
}

export function MonitorRoute(): JSX.Element {
  const { conn, uuids } = useApp();
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {conn != null ? (
          <MonitorScreen conn={conn} uuid={uuids[0] ?? ''} />
        ) : (
          <EmptyState icon="pulse-outline" title="未连接" subtitle="返回登录页建立会话" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function MeRoute(): JSX.Element {
  const { conn, uuids } = useApp();
  const activeUuid = uuids[0];
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {conn != null && activeUuid != null ? (
          <MeScreen conn={conn} uuid={activeUuid} />
        ) : (
          <EmptyState icon="hardware-chip-outline" title="未绑定身份" subtitle="先在主界面完成绑定" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function BqRoute(): JSX.Element {
  const { conn } = useApp();
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {conn != null ? <BqScreen conn={conn} /> : <EmptyState icon="swap-horizontal-outline" title="未连接" subtitle="返回登录页建立会话" />}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SettingsRoute(): JSX.Element {
  const { conn } = useApp();
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <SettingsScreen conn={conn ?? undefined} />
        <AboutScreen />
      </ScrollView>
    </SafeAreaView>
  );
}

export function SessionRoute(): JSX.Element {
  const { conn, disconnect } = useApp();
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {conn != null ? (
          <SessionScreen conn={conn} onSelfRevoked={disconnect} />
        ) : (
          <EmptyState icon="shield-outline" title="未连接" subtitle="返回登录页建立会话" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flexGrow: 1, padding: spacing.l, paddingBottom: spacing.xxl },
  hero: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s },
  brand: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: 1.5 },
  brandSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  count: { color: colors.textFaint, fontSize: 11 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: 12, paddingHorizontal: spacing.l },
  idIcon: { width: 30, height: 30, borderRadius: radius.s, alignItems: 'center', justifyContent: 'center' },
  idText: { color: colors.text, fontSize: 12 },
  idHint: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  tile: {
    width: '48.6%',
    borderRadius: radius.l,
    borderWidth: 1,
    padding: spacing.m,
    gap: 6,
  },
  tileIcon: { width: 30, height: 30, borderRadius: radius.s, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  tileHint: { color: colors.textFaint, fontSize: 10 },
  footer: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: spacing.l },
}));
