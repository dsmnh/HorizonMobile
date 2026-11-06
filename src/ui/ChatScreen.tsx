/**
 * 聊天屏（迁移适配指南 §ChatScreen 深化）：公开/私聊双频道 + 好友与屏蔽管理。
 * 协议面：chat.history（scope: public|private + peer）、chat.public.send / chat.private.send、
 * friend.request/remove/accept、block.set（契约 1.4.0 §聊天域）。
 * 私聊事件按发送/接收双方过滤；发送者回显经流送达，UI 不双份追加。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from './theme';
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
      const res = await conn.req('chat.history', curScope === 'private'
        ? { uuid, scope: 'private', peer: curPeer.trim(), limit: 50 }
        : { uuid, scope: 'public', limit: 50 });
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
      if (e.k === 'msg') {
        // 公开频道并入全部；私聊只并入本人相关（发送或接收）事件
        const relevant = scope === 'public'
          ? e.scope === 'public'
          : e.scope === 'private' && (e.from === peer.trim() || e.to === uuid);
        if (relevant) {
          setMessages((prev) => [...prev, {
            mid: e.mid ?? `${e.seq}`,
            from: e.from ?? '',
            text: e.text ?? '',
            ts: e.ts,
          }]);
        }
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
        setOkMsg(done);
        setFriendOp('');
        setRequestId('');
      } else {
        setError(`${op}: ${res.m ?? '失败'}`);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.scopeRow}>
          <Pressable style={[styles.scopeBtn, scope === 'public' && styles.scopeBtnOn]}
            onPress={() => { setScope('public'); void loadHistory('public', ''); }}>
            <Text style={[styles.scopeText, scope === 'public' && styles.scopeTextOn]}>公开</Text>
          </Pressable>
          <Pressable style={[styles.scopeBtn, scope === 'private' && styles.scopeBtnOn]}
            onPress={() => { setScope('private'); void loadHistory('private', peer); }}>
            <Text style={[styles.scopeText, scope === 'private' && styles.scopeTextOn]}>私聊</Text>
          </Pressable>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => void loadHistory(scope, peer)}>
          <Text style={styles.refreshText}>历史</Text>
        </Pressable>
      </View>

      {scope === 'private' && (
        <TextInput
          style={styles.peerInput}
          value={peer}
          onChangeText={setPeer}
          placeholder="对方 UUID"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          onSubmitEditing={() => void loadHistory('private', peer)}
        />
      )}

      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {okMsg !== '' && <Text style={styles.ok}>{okMsg}</Text>}

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
        ListEmptyComponent={<Text style={styles.empty}>{scope === 'private' ? '与该 UUID 暂无私聊。' : '暂无消息。'}</Text>}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={scope === 'private' ? '私聊发送…' : '发送到公共频道…'}
          placeholderTextColor={colors.faint}
          editable={!sending}
          onSubmitEditing={() => void send()}
        />
        <Pressable style={[styles.sendBtn, sending && styles.disabled]} disabled={sending}
          onPress={() => void send()}>
          <Text style={styles.sendText}>发送</Text>
        </Pressable>
      </View>

      <View style={styles.socialRow}>
        <TextInput style={styles.socialInput} value={friendOp} onChangeText={setFriendOp}
          placeholder="UUID（好友/屏蔽）" placeholderTextColor={colors.faint} autoCapitalize="none" />
        <Pressable style={styles.miniBtn} disabled={!friendOp.trim()}
          onPress={() => void friendAction('friend.request', { to: friendOp.trim() }, '好友请求已发送')}>
          <Text style={styles.miniText}>加好友</Text>
        </Pressable>
        <Pressable style={styles.miniBtn} disabled={!friendOp.trim()}
          onPress={() => void friendAction('friend.remove', { target: friendOp.trim() }, '已移除好友')}>
          <Text style={styles.miniText}>删好友</Text>
        </Pressable>
        <Pressable style={styles.miniBtnDanger} disabled={!friendOp.trim()}
          onPress={() => void friendAction('block.set', { target: friendOp.trim(), blocked: true }, '已屏蔽')}>
          <Text style={styles.miniText}>屏蔽</Text>
        </Pressable>
        <Pressable style={styles.miniBtn} disabled={!friendOp.trim()}
          onPress={() => void friendAction('block.set', { target: friendOp.trim(), blocked: false }, '已取消屏蔽')}>
          <Text style={styles.miniText}>解除</Text>
        </Pressable>
      </View>
      <View style={styles.socialRow}>
        <TextInput style={styles.socialInput} value={requestId} onChangeText={setRequestId}
          placeholder="好友请求 ID（接受）" placeholderTextColor={colors.faint} />
        <Pressable style={styles.miniBtn} disabled={!requestId.trim()}
          onPress={() => void friendAction('friend.accept', { requestId: Number(requestId) }, '已接受好友请求')}>
          <Text style={styles.miniText}>接受好友</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', flex: 1, maxHeight: 620 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scopeRow: { flexDirection: 'row', gap: 6 },
  scopeBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.primary },
  scopeBtnOn: { backgroundColor: colors.primary },
  scopeText: { color: colors.primaryText, fontSize: 13 },
  scopeTextOn: { color: '#FFFFFF' },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.primary },
  refreshText: { color: colors.primaryText, fontSize: 12 },
  peerInput: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 13,
    marginTop: 8,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  ok: { color: colors.ok, fontSize: 13, marginTop: 8 },
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
  socialRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  socialInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 12,
  },
  miniBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  miniBtnDanger: { borderWidth: 1, borderColor: colors.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  miniText: { color: colors.primaryText, fontSize: 11 },
});
