import React, { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fromHistory, type ChatMessage } from '../net/chat-merge';
import { summarizeNodes } from '../net/dashboard';
import type { Res } from '../net/conn';
import { normalizeIdentities } from '../net/identity';
import { Card, StateNotice, StatusDot } from './components';
import { useApp, type MainTabParamList, type RootStackParamList } from './nav';
import { colors, spacing, themedStyles, typography, useTheme } from './theme';

type Snapshot = {
  network?: ReturnType<typeof summarizeNodes>;
  storage?: { mine: number; shared: number };
  team?: string;
  chat?: ChatMessage | null;
  updatedAt?: number;
};

export function HomeOverview({ tabs, navigation }: {
  tabs: BottomTabNavigationProp<MainTabParamList, 'Home'>;
  navigation: NativeStackNavigationProp<RootStackParamList>;
}): JSX.Element {
  const { colors: palette } = useTheme();
  const { conn, connected, identities, activeUuid, setActiveUuid, setIdentities } = useApp();
  const identity = identities.find(({ uuid }) => uuid === activeUuid);
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const [choosingIdentity, setChoosingIdentity] = useState(false);

  const load = useCallback(async (reloadIdentities = false) => {
    if (!conn?.isConnected) return;
    const current = ++request.current;
    setRefreshing(true);
    setFailed(false);
    const [network, storage, team, chat, players] = await Promise.allSettled([
      conn.req('metrics.network', {}),
      activeUuid ? conn.req('me.list', { uuid: activeUuid }) : undefined,
      activeUuid ? conn.req('team.info', { uuid: activeUuid }) : undefined,
      activeUuid ? conn.req('chat.history', { uuid: activeUuid, scope: 'public', limit: 1 }) : undefined,
      reloadIdentities ? conn.req('account.uuids', {}) : undefined,
    ]);
    if (current !== request.current) return;
    setRefreshing(false);
    if (!conn.isConnected) return;
    const body = (result: PromiseSettledResult<Res | undefined>) => result.status === 'fulfilled' && result.value?.ok ? result.value.b : undefined;
    const nodes = body(network)?.nodes;
    const devices = body(storage)?.devices;
    const membership = body(team)?.team;
    const messages = body(chat)?.messages;
    const playerList = body(players)?.uuids;
    const next: Snapshot = {};
    if (Array.isArray(nodes)) next.network = summarizeNodes(nodes);
    if (Array.isArray(devices)) {
      const mine = devices.filter((device) => device.owner === activeUuid).length;
      next.storage = { mine, shared: devices.length - mine };
    }
    if (typeof membership?.name === 'string') next.team = membership.name;
    if (Array.isArray(messages)) next.chat = messages[0] ? fromHistory(messages[0]) : null;
    if (Array.isArray(playerList)) setIdentities(normalizeIdentities(playerList));
    if (Object.keys(next).length) next.updatedAt = Date.now();
    setSnapshot((previous) => ({ ...previous, ...next, ...(body(team) && { team: next.team }) }));
    setFailed(!next.network || (!!activeUuid && (!next.storage || next.chat === undefined)) || (reloadIdentities && !Array.isArray(playerList)));
  }, [conn, activeUuid, setIdentities]);

  useFocusEffect(useCallback(() => {
    if (connected) void load();
    else setRefreshing(false);
    return () => { request.current += 1; };
  }, [connected, load]));

  const { network, storage, team, chat, updatedAt } = snapshot;
  const displayName = identity?.name || (activeUuid ? '游戏角色' : '未绑定角色');
  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.accent} colors={[palette.accent]} />
    }>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={styles.title} accessibilityRole="header">Horizon</Text>
          <View style={styles.connection}>
            <StatusDot ok={connected} />
            <Text style={styles.caption}>{connected ? '后端已连接' : updatedAt ? '连接断开 · 缓存 ' + new Date(updatedAt).toLocaleTimeString() : '连接中断 · 正在重连'}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="我的" onPress={() => navigation.navigate('Profile')}
          style={({ pressed }) => [styles.profile, pressed && styles.pressed]}>
          <PlayerAvatar uuid={activeUuid} size={36} />
        </Pressable>
      </View>
      {failed && connected && <StateNotice>部分总览数据暂不可用，下拉重试</StateNotice>}
      <Card style={styles.identity}>
        <View style={styles.character}>
          <PlayerAvatar uuid={activeUuid} size={56} />
          <View style={styles.grow}>
            <Text style={styles.caption}>当前角色</Text>
            <Text style={styles.characterName} numberOfLines={2}>{displayName}</Text>
            {!!(team || (activeUuid && !identity?.name)) && <Text style={styles.caption} numberOfLines={1}>{team || activeUuid}</Text>}
          </View>
        </View>
        {!activeUuid ? <Action label="绑定游戏身份" onPress={() => navigation.navigate('Bind')} />
          : identities.length > 1 ? <Action label={choosingIdentity ? '收起角色列表' : '切换角色'} onPress={() => setChoosingIdentity(!choosingIdentity)} /> : null}
        {choosingIdentity && identities.filter(({ uuid }) => uuid !== activeUuid).map(({ uuid, name }) => (
          <Action key={uuid} label={name || uuid} onPress={() => setActiveUuid(uuid)} />
        ))}
      </Card>
      <Card>
        <Section icon="pulse-outline" title="服务器状态" action="查看监控" onPress={() => navigation.navigate('Monitor')} />
        <View style={styles.metrics}>
          <Metric label="在服玩家" value={network?.players ?? '—'} />
          <Metric label="在线节点" value={network ? network.online + ' / ' + network.total : '—'} />
          <Metric label="最低 TPS" value={network?.minTps?.toFixed(1) ?? '—'} />
        </View>
      </Card>
      <Card>
        <Section icon="server-outline" title="我的存储" action="查看存储" onPress={() => tabs.navigate('Storage')} />
        <View style={styles.metrics}>
          <Metric label="我的设备" value={storage?.mine ?? '—'} />
          <Metric label="共享给我" value={storage?.shared ?? '—'} />
        </View>
      </Card>
      <Card>
        <Section icon="chatbubbles-outline" title="最近公聊" action="查看聊天" onPress={() => tabs.navigate('Chat')} />
        {chat ? <Text style={styles.message} numberOfLines={2}>{(chat.name || chat.server || '公聊') + '：' + chat.text}</Text>
          : <Text style={styles.caption}>{!activeUuid ? '绑定角色后查看公聊' : chat === null ? '暂无公聊消息' : '暂无可用消息'}</Text>}
      </Card>
    </ScrollView>
  );
}

function PlayerAvatar({ uuid, size }: { uuid: string; size: number }): JSX.Element {
  if (!uuid) return <View style={[styles.avatar, { width: size, height: size }]}><Ionicons name="person-outline" size={size / 2} color={colors.accent} /></View>;
  const seed = Array.from(uuid).reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 0);
  const skin = ['#DCA57C', '#B77A57', '#F1C39C', '#946045'][seed % 4];
  const shade = ['#AE7655', '#8D5639', '#C48E68', '#70482F'][seed % 4];
  const hair = ['#553441', '#362826', '#76563E', '#26354E'][(seed >>> 4) % 4];
  const palette = [
    'hsl(' + (seed % 360) + ',30%,32%)', hair, skin, shade, '#F7EEEE', '#284052',
  ];
  const pixels = ['00111100', '01111110', '01122210', '01222210', '02455420', '02233220', '00233200', '00033000'];
  const pixel = size / 8;
  return <View accessible={false} style={[styles.avatar, { width: size, height: size, overflow: 'hidden' }]}>
    {pixels.map((row, y) => <View key={y} style={{ flexDirection: 'row' }}>
      {Array.from(row, (color, x) => <View key={x} style={{ width: pixel, height: pixel, backgroundColor: palette[Number(color)] }} />)}
    </View>)}
  </View>;
}

function Action({ label, onPress }: { label: string; onPress: () => void }): JSX.Element {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
    <Text style={styles.actionText}>{label}</Text><Ionicons name="chevron-forward" size={14} color={colors.accent} />
  </Pressable>;
}

function Section({ icon, title, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; action: string; onPress: () => void }): JSX.Element {
  return <View style={styles.section}>
    <View style={styles.sectionTitle}><Ionicons name={icon} size={19} color={colors.accent} /><Text style={styles.heading}>{title}</Text></View>
    <Action label={action} onPress={onPress} />
  </View>;
}

function Metric({ value, label }: { value: number | string; label: string }): JSX.Element {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.caption}>{label}</Text></View>;
}

const styles = themedStyles(() => ({
  page: { padding: spacing.l, paddingBottom: spacing.xl, gap: spacing.m },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  grow: { flex: 1, minWidth: 0 },
  connection: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs },
  caption: { ...typography.caption, color: colors.textDim },
  profile: { width: 48, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  avatar: { borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  identity: { backgroundColor: colors.surfaceAlt },
  character: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  characterName: { color: colors.text, fontSize: 22, fontWeight: '800' },
  section: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flexShrink: 1 },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  action: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { color: colors.accent, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  pressed: { opacity: 0.65 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  metric: { flex: 1, flexBasis: 65, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: spacing.s },
  metricValue: { ...typography.metric, color: colors.text },
  message: { color: colors.text, fontSize: 14 },
}));
