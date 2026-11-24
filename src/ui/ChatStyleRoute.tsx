import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { ChatDate, ChatMessageRow } from './ChatMessages';
import { setChatStyle, useChatStyle } from './chatStyle';
import { Chip, SettingsGroup, SettingsRow } from './components';
import { spacing } from './theme';

const sample = {
  mid: 'preview', key: 'preview', from: 'sample', name: '示例玩家', team: '远征小队',
  server: '测试服', world: '主世界', text: '我们在主世界集合。',
};

export function ChatStyleRoute(): JSX.Element {
  const mode = useChatStyle();
  const [expanded, setExpanded] = useState(false);
  return <ScrollView contentContainerStyle={{ padding: spacing.l }}>
    <SettingsGroup title="消息来源">
      <SettingsRow label="经典" detail="点击头像展开服务器与世界" onPress={() => { setExpanded(false); setChatStyle('classic'); }}
        right={mode === 'classic' ? <Chip label="当前" tone="accent" /> : undefined} />
      <SettingsRow label="标签常驻" detail="在发言人后显示可用的来源标签" divider={false} onPress={() => setChatStyle('labels')}
        right={mode === 'labels' ? <Chip label="当前" tone="accent" /> : undefined} />
    </SettingsGroup>
    <ChatDate date="样式预览" />
    <ChatMessageRow message={sample} mode={mode} expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
  </ScrollView>;
}
