import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from './theme';
import { Card, EmptyState, GhostButton, PageHeader, PrimaryButton, SectionLabel, Segmented, StateNotice, StyledInput } from './components';
import type { HorizonConn } from '../net/conn';
import { fromEvent, fromHistory, isRelevant, mergeHistory, type ChatMessage } from '../net/chat-merge';
import { useChatStyle } from './chatStyle';
import { chatDay, ChatDate, ChatMessageRow } from './ChatMessages';

type Channel = { scope: 'public' | 'private'; peer: string };
const publicChannel: Channel = { scope: 'public', peer: '' };

export function ChatScreen({ conn, uuid, connected }: { conn: HorizonConn; uuid: string; connected: boolean }): JSX.Element {
  const { colors } = useTheme();
  const mode = useChatStyle();
  const [scope, setScope] = useState<Channel['scope']>('public');
  const [peerInput, setPeerInput] = useState('');
  const [peer, setPeer] = useState('');
  const channel = scope === 'public' ? publicChannel : { scope, peer };
  const channelKey = scope === 'public' ? 'public' : `private:${peer}`;
  const [store, setStore] = useState<Record<string, ChatMessage[]>>({});
  const messages = store[channelKey] ?? [];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = drafts[channelKey] ?? '';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const [showContacts, setShowContacts] = useState(false);
  const [friendOp, setFriendOp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const friendBusy = useRef(false);
  const sendBusy = useRef(false);
  const historyRequest = useRef(0);
  const fallbackSeq = useRef(0);
  const atEnd = useRef(true);
  const list = useRef<FlatList<ChatMessage>>(null);
  const selected = useRef({ channel, channelKey });
  selected.current = { channel, channelKey };

  useEffect(() => {
    const stream = conn.subscribeStream('chat', { uuid });
    stream.addEventListener((event) => {
      const { channel: current, channelKey: key } = selected.current;
      if (event.k !== 'msg' || !isRelevant(event, current.scope, current.peer, uuid)) return;
      const message = fromEvent(event, ++fallbackSeq.current);
      setStore((previous) => {
        const items = previous[key] ?? [];
        if (items.some((item) => item.key === message.key)) return previous;
        return { ...previous, [key]: [...items, message].slice(-250) };
      });
      if (!atEnd.current) setUnseen(true);
    });
    return () => stream.close();
  }, [conn, uuid]);

  const loadHistory = useCallback(async () => {
    if (!conn.isConnected || (scope === 'private' && !peer)) return;
    const request = ++historyRequest.current;
    setLoading(true);
    setError('');
    try {
      const res = await conn.req('chat.history', { uuid, scope, ...(scope === 'private' ? { peer } : {}), limit: 50 });
      if (request !== historyRequest.current || channelKey !== selected.current.channelKey) return;
      if (!res.ok) throw new Error(res.m ?? '读取聊天历史失败');
      const history: ChatMessage[] = Array.isArray(res.b?.messages) ? res.b.messages.map(fromHistory).reverse() : [];
      setStore((previous) => ({ ...previous, [channelKey]: mergeHistory(history, previous[channelKey] ?? []) }));
    } catch (cause) {
      if (request === historyRequest.current && channelKey === selected.current.channelKey) setError(String((cause as Error).message ?? cause));
    } finally {
      if (request === historyRequest.current) setLoading(false);
    }
  }, [conn, uuid, scope, peer, channelKey]);

  useEffect(() => {
    setExpanded(undefined);
    atEnd.current = true;
    setUnseen(false);
    setError('');
  }, [channelKey]);

  useEffect(() => {
    if (connected) void loadHistory();
    else setLoading(false);
    return () => { historyRequest.current += 1; };
  }, [connected, loadHistory]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !conn.isConnected || sendBusy.current || (scope === 'private' && !peer)) return;
    sendBusy.current = true;
    setSending(true);
    setError('');
    try {
      const res = await (scope === 'private'
        ? conn.req('chat.private.send', { uuid, to: peer, text })
        : conn.req('chat.public.send', { uuid, text }));
      if (!res.ok) throw new Error(res.m ?? '发送失败');
      setDrafts((previous) => previous[channelKey] === draft ? { ...previous, [channelKey]: '' } : previous);
    } catch (cause) {
      if (channelKey === selected.current.channelKey) setError(String((cause as Error).message ?? cause));
    } finally {
      sendBusy.current = false;
      setSending(false);
    }
  };

  const friendAction = async (op: string, p: Record<string, unknown>, done: string) => {
    if (friendBusy.current || !conn.isConnected) return;
    friendBusy.current = true;
    setError('');
    setOkMsg('');
    try {
      const res = await conn.req(op, { uuid, ...p });
      if (res.ok) {
        // 好友请求回包带 id，直接回填到接受输入框，省去手工抄写
        const id = Number(res.b?.id);
        setOkMsg(Number.isFinite(id) && id > 0 ? `${done}（请求 ID ${id}）` : done);
        if (Number.isFinite(id) && id > 0) setRequestId(String(id));
        // 保留输入以便连续操作：屏蔽后立刻解除需要同一 UUID，清空会让按钮变为不可用
        if (op === 'friend.accept') setFriendOp('');
      } else {
        setError(`${op}: ${res.m ?? '失败'}`);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      friendBusy.current = false;
    }
  };

  const canOp = friendOp.trim() !== '' && connected;
  return (
    <View style={styles.wrap}>
      <PageHeader title="聊天" connected={connected} onRefresh={() => void loadHistory()} refreshing={loading} />
      <View style={styles.controls}>
        <View style={{ flex: 1 }}><Segmented value={scope} onChange={setScope} options={[
          { value: 'public', label: '公聊', icon: 'globe-outline' }, { value: 'private', label: '私聊', icon: 'lock-closed-outline' },
        ]} /></View>
        <GhostButton label="好友" icon="people-outline" onPress={() => { setOkMsg(''); setError(''); setShowContacts(true); }} />
      </View>
      {scope === 'private' && <View style={styles.controls}>
        <StyledInput value={peerInput} onChangeText={setPeerInput} placeholder="对方 UUID" style={{ flex: 1 }}
          onSubmitEditing={() => setPeer(peerInput.trim())} />
        <GhostButton label="打开会话" disabled={!peerInput.trim()} onPress={() => setPeer(peerInput.trim())} />
      </View>}
      {scope === 'private' && peer && <SectionLabel text={`私聊对象 · ${peer}`} />}
      {!connected && <StateNotice>连接中断，保留已加载消息和草稿</StateNotice>}
      {!showContacts && error !== '' && <StateNotice tone="bad">{error}</StateNotice>}
      {loading && messages.length === 0 && <StateNotice tone="neutral" loading>正在读取聊天历史</StateNotice>}
      <FlatList key={channelKey} ref={list} data={messages} keyExtractor={(message) => message.key} style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.s }} scrollEventThrottle={32}
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
          atEnd.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 56;
          if (atEnd.current) setUnseen(false);
        }}
        onContentSizeChange={() => { if (messages.length > 0 && atEnd.current) list.current?.scrollToEnd({ animated: false }); }}
        renderItem={({ item, index }) => {
          const previous = messages[index - 1];
          const date = chatDay(item.ts);
          const newDay = Boolean(date && date !== chatDay(previous?.ts));
          const grouped = !newDay && previous?.from === item.from && previous.server === item.server
            && previous.team === item.team && previous.world === item.world && previous.name === item.name
            && (item.ts ?? 0) - (previous.ts ?? 0) <= ((item.ts ?? 0) >= 1e12 ? 60000 : 60);
          return <>{newDay && date && <ChatDate date={date} />}
            <ChatMessageRow message={item} mine={item.from === uuid} grouped={grouped} mode={mode}
              expanded={expanded === item.key} onToggle={() => setExpanded((key) => key === item.key ? undefined : item.key)} />
          </>;
        }}
        ListEmptyComponent={!loading && !error ? <EmptyState icon="chatbubble-ellipses-outline"
          title={connected ? '暂无消息' : '暂无已加载消息'} subtitle={scope === 'private' && !peer ? '输入对方 UUID 并打开会话' : undefined} /> : null} />
      {unseen && <GhostButton label="查看新消息" icon="arrow-down" onPress={() => {
        atEnd.current = true; setUnseen(false); list.current?.scrollToEnd({ animated: true });
      }} />}
      <View style={styles.controls}>
        <StyledInput value={draft} onChangeText={(text) => setDrafts((previous) => ({ ...previous, [channelKey]: text }))}
          placeholder={scope === 'private' ? '输入私聊消息' : '输入公聊消息'} style={{ flex: 1 }} />
        <PrimaryButton label="发送" icon="send" loading={sending} disabled={!connected || !draft.trim() || (scope === 'private' && !peer)}
          onPress={() => void send()} />
      </View>
      <Modal visible={showContacts} onRequestClose={() => setShowContacts(false)} animationType="slide">
        <ScrollView style={[styles.wrap, { backgroundColor: colors.bg }]} keyboardShouldPersistTaps="handled">
          <PageHeader title="好友与屏蔽" connected={connected} />
          {error !== '' && <StateNotice tone="bad">{error}</StateNotice>}
          {okMsg !== '' && <StateNotice tone="neutral">{okMsg}</StateNotice>}
          <Card>
        <StyledInput value={friendOp} onChangeText={setFriendOp} placeholder="目标玩家 UUID" />
        <View style={styles.chipRow}>
          <GhostButton label="加好友" icon="person-add-outline" disabled={!canOp}
            onPress={() => void friendAction('friend.request', { to: friendOp.trim() }, '好友请求已发送')} />
          <GhostButton label="删好友" icon="person-remove-outline" tone="neutral" disabled={!canOp}
            onPress={() => void friendAction('friend.remove', { target: friendOp.trim() }, '已移除好友')} />
          <GhostButton label="屏蔽" icon="ban-outline" tone="bad" disabled={!canOp}
            onPress={() => void friendAction('block.set', { target: friendOp.trim(), blocked: true }, '已屏蔽')} />
          <GhostButton label="解除" icon="checkmark-circle-outline" tone="neutral" disabled={!canOp}
            onPress={() => void friendAction('block.set', { target: friendOp.trim(), blocked: false }, '已取消屏蔽')} />
        </View>
        <View style={{ marginTop: spacing.m }}>
          <StyledInput value={requestId} onChangeText={setRequestId} placeholder="好友请求 ID（接受）" />
        </View>
        <View style={{ marginTop: spacing.s }}>
          <GhostButton label="接受好友请求" icon="checkmark-done-outline" disabled={!/^\d+$/.test(requestId.trim())}
            onPress={() => void friendAction('friend.accept', { requestId: Number(requestId) }, '已接受好友请求')} />
        </View>
          </Card>
          <GhostButton label="返回聊天" icon="arrow-back" onPress={() => { setError(''); setShowContacts(false); }} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m, paddingBottom: spacing.s },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.s },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
});
