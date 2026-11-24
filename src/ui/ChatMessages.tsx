import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../net/chat-merge';
import { radius, spacing, useTheme } from './theme';
import type { ChatStyle } from './chatStyle';

function toDate(ts?: number): Date | undefined {
  if (ts === undefined) return undefined;
  const date = new Date(ts < 1e12 ? ts * 1000 : ts);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function chatDay(ts?: number): string | undefined {
  return toDate(ts)?.toLocaleDateString('zh-CN');
}

export function ChatDate({ date }: { date: string }): JSX.Element {
  const { colors } = useTheme();
  return <Text style={[styles.date, { color: colors.textDim, backgroundColor: colors.surfaceAlt }]}>{date}</Text>;
}

export function ChatMessageRow({ message, grouped, mine, mode, expanded, onToggle }: {
  message: ChatMessage; grouped?: boolean; mine?: boolean; mode: ChatStyle; expanded?: boolean; onToggle: () => void;
}): JSX.Element {
  const { colors } = useTheme();
  const name = message.name || message.from || '系统通知';
  // 1.6.5：队伍标签带来源（official 官方队伍 / su ServerUtilities），用不同色区分两套系统
  const tags: { text: string; official: boolean }[] = [];
  if (message.team) tags.push({ text: message.team, official: message.teamSource === 'official' });
  if (mode === 'labels' || expanded) {
    if (message.server) tags.push({ text: message.server, official: false });
    if (message.world) tags.push({ text: message.world, official: false });
  }
  const canExpand = mode === 'classic' && Boolean(message.server || message.world);
  const hue = Array.from(message.from + (message.server ?? '')).reduce((value, character) => (value * 31 + character.charCodeAt(0)) % 360, 0);
  const time = toDate(message.ts)?.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (!message.from) return <ChatDate date={message.text} />;
  return (
    <View style={[styles.row, mine && styles.mine, grouped && styles.continuation]}>
      <View style={styles.avatarSlot}>
        {!grouped && <Pressable onPress={onToggle} disabled={!canExpand} accessibilityRole={canExpand ? 'button' : undefined}
          accessibilityLabel={canExpand ? `${name}的消息来源` : undefined} accessibilityState={canExpand ? { expanded } : undefined}
          style={styles.avatarTarget}>
          <View style={[styles.avatar, { backgroundColor: `hsl(${hue}, 45%, 36%)` }]}>
            <Text style={styles.initial}>{Array.from(name)[0]}</Text>
          </View>
        </Pressable>}
      </View>
      <View style={[styles.message, mine && styles.messageMine]}>
        {!grouped && <View style={[styles.meta, mine && styles.metaMine]}>
          <Text style={[styles.name, { color: colors.textDim }]}>{name}</Text>
          {tags.map((tag, index) => <Text key={index} style={[styles.label,
            { color: tag.official ? colors.accent2 : colors.accent,
              backgroundColor: tag.official ? colors.accent2Soft : colors.accentSoft }]}>{tag.text}</Text>)}
        </View>}
        <View style={[styles.bubble, { backgroundColor: mine ? colors.accentSoft : colors.surface }]}>
          <Text selectable style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{message.text}</Text>
          {time && <Text style={[styles.time, { color: colors.textFaint }]}>{time}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  date: { alignSelf: 'center', borderRadius: 16, paddingHorizontal: spacing.m, paddingVertical: spacing.xs, marginVertical: spacing.m, fontSize: 11 },
  row: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.m },
  mine: { flexDirection: 'row-reverse' },
  continuation: { marginTop: spacing.xs },
  avatarSlot: { width: 48 },
  avatarTarget: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  initial: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  message: { maxWidth: '80%', flexShrink: 1, alignItems: 'flex-start' },
  messageMine: { alignItems: 'flex-end' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  metaMine: { justifyContent: 'flex-end' },
  name: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 10, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 1 },
  bubble: { borderRadius: radius.m, paddingVertical: spacing.s, paddingHorizontal: spacing.m, maxWidth: '100%' },
  time: { fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },
});
