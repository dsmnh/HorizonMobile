import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, useTheme } from './theme';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { HomeOverview } from './HomeOverview';
import { useApp, type MainTabParamList, type RootStackParamList, type RootStackProps } from './nav';
import { EmptyState, PageHeader, SettingsGroup, SettingsRow } from './components';
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
import { useChatStyle } from './chatStyle';

function TabPage({ children }: { children: React.ReactNode }): JSX.Element {
  const { colors } = useTheme();
  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.bg }]}>{children}</SafeAreaView>;
}

function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

export function LoginRoute(): JSX.Element {
  const { authenticate, resetPassword, busy, error } = useApp();
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <LoginScreen onAuthenticate={authenticate} onResetPassword={resetPassword} busy={busy} error={error} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function HomeRoute({ navigation }: BottomTabScreenProps<MainTabParamList, 'Home'>): JSX.Element {
  const root = useRootNavigation();
  const { activeUuid } = useApp();
  return <TabPage><HomeOverview key={activeUuid} tabs={navigation} navigation={root} /></TabPage>;
}

export function ToolsRoute(): JSX.Element {
  const navigation = useRootNavigation();
  const { connected } = useApp();
  return <TabPage>
    <ScrollView contentContainerStyle={styles.body}>
      <PageHeader title="工具" connected={connected} />
      <SettingsGroup title="服务器">
        <SettingsRow icon="pulse-outline" label="监控" detail="节点、玩家与运行指标" onPress={() => navigation.navigate('Monitor')} />
        <SettingsRow icon="shield-checkmark-outline" label="服务器管理" detail="在线榜同步与玩家 OP 管理" divider={false} onPress={() => navigation.navigate('ServerTools')} />
      </SettingsGroup>
      <SettingsGroup title="协作">
        <SettingsRow icon="people-outline" label="我的队伍" detail="成员、邀请与审批" divider={false} onPress={() => navigation.navigate('Team')} />
      </SettingsGroup>
      <SettingsGroup title="同步">
        <SettingsRow icon="swap-horizontal-outline" label="BQ 同步" detail="跨服任务同步" divider={false} onPress={() => navigation.navigate('Bq')} />
      </SettingsGroup>
      <SettingsGroup title="个人">
        <SettingsRow icon="person-circle-outline" label="我的" detail="账号、身份与外观" divider={false} onPress={() => navigation.navigate('Profile')} />
      </SettingsGroup>
    </ScrollView>
  </TabPage>;
}

export function ProfileRoute(): JSX.Element {
  const navigation = useRootNavigation();
  const { account, activeUuid, identities, disconnect } = useApp();
  const character = identities.find(({ uuid }) => uuid === activeUuid);
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <SettingsGroup title="账号与身份">
          <SettingsRow icon="person-circle" label={account} detail={character?.name || activeUuid || '未绑定游戏身份'} />
          <SettingsRow icon="link-outline" label="绑定游戏身份" divider={false} onPress={() => navigation.navigate('Bind')} />
        </SettingsGroup>
        <SettingsGroup title="连接与安全">
          <SettingsRow icon="shield-checkmark-outline" label="登录会话" onPress={() => navigation.navigate('Session')} />
          <SettingsRow icon="settings-outline" label="连接设置与证书" divider={false} onPress={() => navigation.navigate('Settings')} />
        </SettingsGroup>
        <SettingsGroup title="外观">
          <AppearanceRows onChatStyle={() => navigation.navigate('ChatStyle')} />
        </SettingsGroup>
        <SettingsGroup title="关于">
          <SettingsRow icon="information-circle-outline" label="Horizon" detail="深空矩阵新视野" value="0.1.0" divider={false} />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow icon="log-out-outline" label="退出登录" tone="bad" divider={false}
            onPress={() => Alert.alert('退出登录', '退出当前账号？', [
              { text: '取消', style: 'cancel' }, { text: '退出登录', style: 'destructive', onPress: disconnect },
            ])} />
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}

function AppearanceRows({ onChatStyle }: { onChatStyle: () => void }): JSX.Element {
  const { mode, setMode } = useTheme();
  const chatStyle = useChatStyle();
  return <>
    <SettingsRow icon={mode === 'dark' ? 'moon' : 'sunny'} label="主题" value={mode === 'dark' ? '深色' : '浅色'}
      onPress={() => Alert.alert('主题', undefined, [
        { text: '深色', onPress: () => setMode('dark') },
        { text: '浅色', onPress: () => setMode('light') },
        { text: '取消', style: 'cancel' },
      ])} />
    <SettingsRow icon="chatbubble-ellipses-outline" label="聊天样式" value={chatStyle === 'classic' ? '经典' : '标签常驻'} divider={false} onPress={onChatStyle} />
  </>;
}

export function BindRoute({ navigation }: RootStackProps<'Bind'>): JSX.Element {
  const { conn, identities, setIdentities } = useApp();
  return <View style={styles.root}>{conn && <BindScreen conn={conn} onBound={(list, partial) => {
    if (list.length) {
      setIdentities(partial ? [...identities, ...list.filter(({ uuid }) => !identities.some((identity) => identity.uuid === uuid))] : list);
      navigation.goBack();
    }
  }} />}</View>;
}

const bindingHint = '先在首页绑定游戏身份';

export function TeamRoute(): JSX.Element {
  const { conn, activeUuid } = useApp();
  const [revision, refresh] = React.useReducer((value: number) => value + 1, 0);
  return (
    <ScrollView key={activeUuid} contentContainerStyle={styles.body}>
      {conn && activeUuid ? <>
        <SettingsGroup title="当前身份"><SettingsRow icon="person-outline" label={activeUuid} divider={false} /></SettingsGroup>
        <TeamScreen key={revision} conn={conn} uuid={activeUuid} />
        <TeamRosterScreen key={'roster-' + revision} conn={conn} uuid={activeUuid} />
        <TeamOpsScreen conn={conn} uuid={activeUuid} onChanged={refresh} />
      </> : <EmptyState icon="people-outline" title="未绑定身份" subtitle={bindingHint} />}
    </ScrollView>
  );
}

export function ChatRoute(): JSX.Element {
  const { conn, activeUuid, connected } = useApp();
  const navigation = useRootNavigation();
  return (
    <TabPage>
      {conn && activeUuid ? <ChatScreen key={activeUuid} conn={conn} uuid={activeUuid} connected={connected} /> : (
        <View style={styles.body}>
          <PageHeader title="聊天" connected={connected} />
          <SettingsGroup><SettingsRow icon="link-outline" label="绑定身份后使用聊天" divider={false} onPress={() => navigation.navigate('Bind')} /></SettingsGroup>
        </View>
      )}
    </TabPage>
  );
}

export function MonitorRoute(): JSX.Element {
  const { conn, connected } = useApp();
  return <View style={styles.root}>{conn && <MonitorScreen conn={conn} connected={connected} />}</View>;
}

export function ServerToolsRoute(): JSX.Element {
  const { conn, activeUuid, connected } = useApp();
  return <View style={styles.root}>{conn && <MonitorScreen key={activeUuid} conn={conn} uuid={activeUuid} connected={connected} management />}</View>;
}

export function StorageRoute(): JSX.Element {
  const { conn, activeUuid, connected } = useApp();
  const navigation = useRootNavigation();
  return <TabPage>
    {conn && activeUuid ? <MeScreen key={activeUuid} conn={conn} uuid={activeUuid} connected={connected} /> : (
      <View style={styles.body}>
        <PageHeader title="存储" connected={connected} />
        <SettingsGroup><SettingsRow icon="link-outline" label="绑定身份后查看存储" divider={false} onPress={() => navigation.navigate('Bind')} /></SettingsGroup>
      </View>
    )}
  </TabPage>;
}

export function BqRoute(): JSX.Element {
  const { conn } = useApp();
  return <View style={styles.root}>{conn && <BqScreen conn={conn} />}</View>;
}

export function SettingsRoute(): JSX.Element {
  return <ScrollView contentContainerStyle={styles.body}><SettingsScreen /></ScrollView>;
}

export function SessionRoute(): JSX.Element {
  const { conn, disconnect } = useApp();
  return <View style={styles.root}>{conn && <SessionScreen conn={conn} onSelfRevoked={disconnect} />}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m, paddingBottom: spacing.xl },
});
