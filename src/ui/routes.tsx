/**
 * 路由包装层：从 AppContext 取值下传给既有屏幕组件（屏幕保持 props 无感）。
 * LoginRoute 在鉴权成功后跳 Home；各功能屏自行处理未连接回退。
 */
import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';
import { useApp, type RootStackProps } from './nav';
import { LoginScreen } from './LoginScreen';
import { TeamScreen } from './TeamScreen';
import { TeamOpsScreen } from './TeamOpsScreen';
import { TeamRosterScreen } from './TeamRosterScreen';
import { ChatScreen } from './ChatScreen';
import { MonitorScreen } from './MonitorScreen';
import { SessionScreen } from './SessionScreen';
import { BindScreen } from './BindScreen';
import { AboutScreen } from './AboutScreen';

export function LoginRoute({ navigation }: RootStackProps<'Login'>): JSX.Element {
  const { authenticate, busy, error, conn } = useApp();
  // 鉴权成功（conn 就位）即进入主界面
  React.useEffect(() => {
    if (conn) {
      navigation.replace('Home');
    }
  }, [conn, navigation]);
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <LoginScreen onAuthenticate={authenticate} busy={busy} error={error} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function HomeRoute({ navigation }: RootStackProps<'Home'>): JSX.Element {
  const { conn, connected, uuids, setUuids, disconnect } = useApp();
  const [selected, setSelected] = useState<string>('');

  // 会话被撤销/断开：回登录屏
  React.useEffect(() => {
    if (!conn) {
      navigation.replace('Login');
    }
  }, [conn, navigation]);

  const activeUuid = uuids.includes(selected) ? selected : uuids[0];

  const menu: { label: string; route: 'Team' | 'Chat' | 'Monitor' | 'Session' }[] = [
    { label: '队伍', route: 'Team' },
    { label: '聊天', route: 'Chat' },
    { label: '监控', route: 'Monitor' },
    { label: '会话', route: 'Session' },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]} />
          <Text style={styles.statusText}>{connected ? '已连接' : '连接中断，自动重连中…'}</Text>
        </View>

        {uuids.length === 0 ? (
          conn != null && (
            <BindScreen
              conn={conn}
              onBound={(list) => {
                if (list.length > 0) setUuids(list);
              }}
            />
          )
        ) : (
          <View>
            <Text style={styles.sectionLabel}>绑定身份</Text>
            {uuids.map((u) => (
              <Pressable key={u} style={[styles.uuidRow, u === activeUuid && styles.uuidRowActive]}
                onPress={() => setSelected(u)}>
                <Text style={[styles.uuidText, u === activeUuid && styles.uuidTextActive]}>
                  {u}{u === activeUuid ? '  ← 当前' : ''}
                </Text>
              </Pressable>
            ))}
            <View style={styles.menuRow}>
              {menu.map((m) => (
                <Pressable key={m.route} style={styles.menuBtn}
                  onPress={() => navigation.navigate(m.route)}>
                  <Text style={styles.menuBtnText}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {conn != null && uuids.length === 0 && <MonitorScreen conn={conn} />}
        <Pressable style={styles.disconnectBtn} onPress={disconnect}>
          <Text style={styles.disconnectText}>断开连接</Text>
        </Pressable>
        <AboutScreen />
        <Text style={styles.footer}>Horizon · 协议 1.5.x · 会话经 HMAC 鉴权</Text>
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
          <Text style={styles.empty}>未绑定身份：先在主界面完成绑定。</Text>
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
        <Text style={styles.empty}>未绑定身份：先在主界面完成绑定。</Text>
      )}
    </SafeAreaView>
  );
}

export function MonitorRoute(): JSX.Element {
  const { conn } = useApp();
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {conn != null ? <MonitorScreen conn={conn} /> : <Text style={styles.empty}>未连接。</Text>}
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
          <Text style={styles.empty}>未连接。</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flexGrow: 1, padding: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  dotOn: { backgroundColor: colors.ok },
  dotOff: { backgroundColor: colors.warn },
  statusText: { color: colors.muted, fontSize: 13 },
  sectionLabel: { color: colors.faint, fontSize: 12, marginTop: 6, marginBottom: 4 },
  uuidRow: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  uuidRowActive: { borderWidth: 1, borderColor: colors.primary },
  uuidText: { color: colors.text, fontSize: 13 },
  uuidTextActive: { color: colors.primaryText },
  menuRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  menuBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  menuBtnText: { color: colors.primaryText, fontSize: 14, fontWeight: '600' },
  disconnectBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  disconnectText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  footer: { color: colors.faint, fontSize: 11, textAlign: 'center', marginTop: 14 },
  empty: { color: colors.faint, fontSize: 13, marginTop: 20 },
});
