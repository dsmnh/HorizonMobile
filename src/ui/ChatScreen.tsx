/**
 * 聊天屏基础版（迁移适配指南 §ChatScreen，阶段 3 公共频道）：
 * chat.history 拉取 + chat 流实时事件 + chat.public.send 发送。
 * 好友/私聊选择器与屏蔽管理随后续迁移增量（guide §ChatScreen 工作量=大）。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../ui/theme';
import { HorizonConn, type Stream, type TeamEvent } from '../net/conn';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const streamRef = useRef<Stream | null>(null);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const loadHistory = useCallback(async () => {
    setError('');
    try {
      const res = await conn.req('chat.history', { uuid, scope: 'public', limit: 50 });
      if (res.ok) {
        const list = Array.isArray(res.b?.messages) ? res.b.messages : [];
        setMessages(list.map((m: any) => ({ mid: m.mid, from: m.from, text: m.text, ts: m.ts })));
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
      // 契约 1.4.0：chat 流事件 k=msg；增量并入列表尾部
      if (e.k === 'msg') {
        setMessages((prev) => [...prev, {
          mid: e.mid ?? `${e.seq}`,
          from: e.from ?? '',
          text: e.text ?? '',
          ts: e.ts,
        }]);
      }
    });
    void loadHistory();
    return () => {
      stream.close();
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, uuid]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await conn.req('chat.public.send', { uuid, text });
      if (!res.ok) {
        setError(res.m ?? '发送失败');
      } else {
        setDraft('');
        // 发送者自身经 chat 流收到回显事件；此处不再本地追加，避免双份
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  }, [conn, uuid, draft, sending]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>公共频道</Text>
        <Pressable style={styles.refreshBtn} onPress={() => void loadHistory()}>
          <Text style={styles.refreshText}>历史</Text>
        </Pressable>
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.mid)}
        style={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={styles.msgRow}>
            <Text style={styles.msgFrom} numberOfLines={1}>{item.from}</Text>
            <Text style={styles.msgText}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无消息。</Text>}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="发送到公共频道…"
          placeholderTextColor="#5A6B8C"
          editable={!sending}
          onSubmitEditing={() => void send()}
        />
        <Pressable style={[styles.sendBtn, sending && styles.disabled]} disabled={sending}
          onPress={() => void send()}>
          <Text style={styles.sendText}>发送</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', flex: 1, maxHeight: 520 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.primary },
  refreshText: { color: colors.primaryText, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  list: { marginTop: 10, flexGrow: 0 },
  msgRow: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  msgFrom: { color: colors.muted, fontSize: 11 },
  msgText: { color: colors.text, fontSize: 14, marginTop: 2 },
  empty: { color: colors.faint, fontSize: 13, marginTop: 10 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
