/**
 * 聊天屏（迁移适配指南 §ChatScreen 深化）：公开/私聊双频道 + 好友与屏蔽管理。
 * 协议面：chat.history（scope: public|private + peer）、chat.public.send / chat.private.send、
 * friend.request/remove/accept、block.set（契约 1.4.0 §聊天域）。
 * 私聊事件按发送/接收双方过滤；发送者回显经流送达，UI 不双份追加。
 * 视觉对齐 AEMobileApp：频道分段器 + 气泡列表 + 底部输入条。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles, useTheme } from './theme';
import { Card, Chip, EmptyState, GhostButton, PrimaryButton, SectionLabel, Segmented, StyledInput } from './components';
import { HorizonConn, type Stream, type TeamEvent } from '../net/conn';
import { fromEvent, fromHistory, isRelevant } from '../net/chat-merge';

interface ChatMessage {
  mid: number | string;
  from: string;
  text: string;
  ts?: number;
}

export interface ChatScreenProps {
  conn: HorizonConn;
  uuid: string;
}

export function ChatScreen({ conn, uuid }: ChatScreenProps): JSX.Element {
  const { colors: c } = useTheme();
  const [scope, setScope] = useState<'public' | 'private'>('public');
  const [peer, setPeer] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [friendOp, setFriendOp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [sending, setSending] = useState(false);
  const streamRef = useRef<Stream | null>(null);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const loadHistory = useCallback(async (curScope: 'public' | 'private', curPeer: string) => {
    setError('');
    try {
      // 私聊历史必须带 peer，未填时不发请求（后端按 BAD_PARAMS:peer 拒绝）
      if (curScope === 'private' && !curPeer.trim()) {
        setMessages([]);
        return;
      }
      const res = await conn.req('chat.history', curScope === 'private'
        ? { uuid, scope: 'private', peer: curPeer.trim(), limit: 50 }
        : { uuid, scope: 'public', limit: 50 });
      if (res.ok) {
        const list = Array.isArray(res.b?.messages) ? res.b.messages : [];
        setMessages(list.map(fromHistory).reverse());
      } else {
        setError(res.m ?? 'chat.history 失败');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }, [conn, uuid]);

  useEffect(() => {
    const stream = conn.subscribeStream('chat', { uuid });
    streamRef.current = stream;
    stream.addEventListener((e: TeamEvent) => {
      if (e.k === 'msg' && isRelevant(e as any, scope, peer, uuid)) {
        setMessages((prev) => [...prev, fromEvent(e as any, prev.length + 1)]);
      }
    });
    void loadHistory(scope, peer);
    return () => {
      stream.close();
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, uuid, scope, peer]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (scope === 'private' && !peer.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = scope === 'private'
        ? await conn.req('chat.private.send', { uuid, to: peer.trim(), text })
        : await conn.req('chat.public.send', { uuid, text });
      if (!res.ok) {
        setError(res.m ?? '发送失败');
      } else {
        setDraft('');
        // 双方经 chat 流收到回显事件；此处不本地追加，避免双份
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  }, [conn, uuid, draft, sending, scope, peer]);

  const friendAction = async (op: string, p: Record<string, unknown>, done: string) => {
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
    }
  };

  const canOp = friendOp.trim() !== '';

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Segmented
          options={[
            { value: 'public', label: '公聊', icon: 'globe-outline' },
            { value: 'private', label: '私聊', icon: 'lock-closed-outline' },
          ]}
          value={scope}
          onChange={(v) => { setScope(v); void loadHistory(v, peer); }}
        />
      </View>

      {scope === 'private' && (
        <View style={{ marginTop: spacing.s }}>
          <StyledInput
            value={peer}
            onChangeText={setPeer}
            placeholder="对方 UUID"
            onSubmitEditing={() => void loadHistory('private', peer)}
          />
        </View>
      )}

      {error !== '' && (
        <View style={[styles.msgBox, { backgroundColor: c.badSoft, borderColor: c.bad + '55' }]}>
          <Text style={[styles.msgText, { color: c.bad }]}>{error}</Text>
        </View>
      )}
      {okMsg !== '' && (
        <View style={[styles.msgBox, { backgroundColor: c.okSoft, borderColor: c.ok + '55' }]}>
          <Text style={[styles.msgText, { color: c.ok }]}>{okMsg}</Text>
        </View>
      )}

      <Card style={styles.listCard}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.mid)}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: spacing.s }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
              <Text style={styles.bubbleFrom} numberOfLines={1}>{item.from}</Text>
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title={scope === 'private' ? '暂无该会话消息' : '暂无消息'}
              subtitle={scope === 'private' ? '填写对方 UUID 后拉取历史' : '在下方输入框发送第一条公聊'}
            />
          }
        />
      </Card>

      <View style={styles.sendRow}>
        <StyledInput
          value={draft}
          onChangeText={setDraft}
          placeholder={scope === 'private' ? '私聊发送…' : '发送到公共频道…'}
          editable={!sending}
          style={{ flex: 1 }}
        />
        <PrimaryButton label="发送" icon="send" onPress={() => void send()} loading={sending} />
      </View>

      <SectionLabel text="好友与屏蔽" right={<Chip label={scope === 'private' ? '私聊' : '公聊'} tone="accent2" />} />
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
          <GhostButton label="接受好友请求" icon="checkmark-done-outline" disabled={requestId.trim() === ''}
            onPress={() => void friendAction('friend.accept', { requestId: Number(requestId) }, '已接受好友请求')} />
        </View>
      </Card>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, padding: spacing.l },
  headRow: { marginBottom: spacing.s },
  msgBox: { marginTop: spacing.s, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  msgText: { fontSize: 12, lineHeight: 17 },
  listCard: { flex: 1, marginTop: spacing.s, padding: spacing.s },
  list: { flexGrow: 1 },
  bubble: { borderRadius: radius.m, borderWidth: 1, paddingVertical: 8, paddingHorizontal: spacing.m, marginBottom: 6 },
  bubbleFrom: { color: colors.textFaint, fontSize: 10 },
  bubbleText: { color: colors.text, fontSize: 14, marginTop: 2, lineHeight: 20 },
  sendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.s },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
}));
