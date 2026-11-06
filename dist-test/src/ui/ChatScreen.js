"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatScreen = ChatScreen;
/**
 * 聊天屏（迁移适配指南 §ChatScreen 深化）：公开/私聊双频道 + 好友与屏蔽管理。
 * 协议面：chat.history（scope: public|private + peer）、chat.public.send / chat.private.send、
 * friend.request/remove/accept、block.set（契约 1.4.0 §聊天域）。
 * 私聊事件按发送/接收双方过滤；发送者回显经流送达，UI 不双份追加。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("./theme");
function ChatScreen({ conn, uuid }) {
    const [scope, setScope] = (0, react_1.useState)('public');
    const [peer, setPeer] = (0, react_1.useState)('');
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [draft, setDraft] = (0, react_1.useState)('');
    const [friendOp, setFriendOp] = (0, react_1.useState)('');
    const [requestId, setRequestId] = (0, react_1.useState)('');
    const [error, setError] = (0, react_1.useState)('');
    const [okMsg, setOkMsg] = (0, react_1.useState)('');
    const [sending, setSending] = (0, react_1.useState)(false);
    const streamRef = (0, react_1.useRef)(null);
    const listRef = (0, react_1.useRef)(null);
    const loadHistory = (0, react_1.useCallback)(async (curScope, curPeer) => {
        setError('');
        try {
            const res = await conn.req('chat.history', curScope === 'private'
                ? { uuid, scope: 'private', peer: curPeer.trim(), limit: 50 }
                : { uuid, scope: 'public', limit: 50 });
            if (res.ok) {
                const list = Array.isArray(res.b?.messages) ? res.b.messages : [];
                setMessages(list.map((m) => ({ mid: m.mid, from: m.from, text: m.text, ts: m.ts })));
            }
            else {
                setError(res.m ?? 'chat.history 失败');
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
    }, [conn, uuid]);
    (0, react_1.useEffect)(() => {
        const stream = conn.subscribeStream('chat', { uuid });
        streamRef.current = stream;
        stream.addEventListener((e) => {
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
    const send = (0, react_1.useCallback)(async () => {
        const text = draft.trim();
        if (!text || sending)
            return;
        if (scope === 'private' && !peer.trim())
            return;
        setSending(true);
        setError('');
        try {
            const res = scope === 'private'
                ? await conn.req('chat.private.send', { uuid, to: peer.trim(), text })
                : await conn.req('chat.public.send', { uuid, text });
            if (!res.ok) {
                setError(res.m ?? '发送失败');
            }
            else {
                setDraft('');
                // 双方经 chat 流收到回显事件；此处不本地追加，避免双份
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
        finally {
            setSending(false);
        }
    }, [conn, uuid, draft, sending, scope, peer]);
    const friendAction = async (op, p, done) => {
        setError('');
        setOkMsg('');
        try {
            const res = await conn.req(op, { uuid, ...p });
            if (res.ok) {
                setOkMsg(done);
                setFriendOp('');
                setRequestId('');
            }
            else {
                setError(`${op}: ${res.m ?? '失败'}`);
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
    };
    return (<react_native_1.View style={styles.card}>
      <react_native_1.View style={styles.headerRow}>
        <react_native_1.View style={styles.scopeRow}>
          <react_native_1.Pressable style={[styles.scopeBtn, scope === 'public' && styles.scopeBtnOn]} onPress={() => { setScope('public'); void loadHistory('public', ''); }}>
            <react_native_1.Text style={[styles.scopeText, scope === 'public' && styles.scopeTextOn]}>公开</react_native_1.Text>
          </react_native_1.Pressable>
          <react_native_1.Pressable style={[styles.scopeBtn, scope === 'private' && styles.scopeBtnOn]} onPress={() => { setScope('private'); void loadHistory('private', peer); }}>
            <react_native_1.Text style={[styles.scopeText, scope === 'private' && styles.scopeTextOn]}>私聊</react_native_1.Text>
          </react_native_1.Pressable>
        </react_native_1.View>
        <react_native_1.Pressable style={styles.refreshBtn} onPress={() => void loadHistory(scope, peer)}>
          <react_native_1.Text style={styles.refreshText}>历史</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      {scope === 'private' && (<react_native_1.TextInput style={styles.peerInput} value={peer} onChangeText={setPeer} placeholder="对方 UUID" placeholderTextColor={theme_1.colors.faint} autoCapitalize="none" onSubmitEditing={() => void loadHistory('private', peer)}/>)}

      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}
      {okMsg !== '' && <react_native_1.Text style={styles.ok}>{okMsg}</react_native_1.Text>}

      <react_native_1.FlatList ref={listRef} data={messages} keyExtractor={(m) => String(m.mid)} style={styles.list} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })} renderItem={({ item }) => (<react_native_1.View style={styles.msgRow}>
            <react_native_1.Text style={styles.msgFrom} numberOfLines={1}>{item.from}</react_native_1.Text>
            <react_native_1.Text style={styles.msgText}>{item.text}</react_native_1.Text>
          </react_native_1.View>)} ListEmptyComponent={<react_native_1.Text style={styles.empty}>{scope === 'private' ? '与该 UUID 暂无私聊。' : '暂无消息。'}</react_native_1.Text>}/>

      <react_native_1.View style={styles.inputRow}>
        <react_native_1.TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder={scope === 'private' ? '私聊发送…' : '发送到公共频道…'} placeholderTextColor={theme_1.colors.faint} editable={!sending} onSubmitEditing={() => void send()}/>
        <react_native_1.Pressable style={[styles.sendBtn, sending && styles.disabled]} disabled={sending} onPress={() => void send()}>
          <react_native_1.Text style={styles.sendText}>发送</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      <react_native_1.View style={styles.socialRow}>
        <react_native_1.TextInput style={styles.socialInput} value={friendOp} onChangeText={setFriendOp} placeholder="UUID（好友/屏蔽）" placeholderTextColor={theme_1.colors.faint} autoCapitalize="none"/>
        <react_native_1.Pressable style={styles.miniBtn} disabled={!friendOp.trim()} onPress={() => void friendAction('friend.request', { to: friendOp.trim() }, '好友请求已发送')}>
          <react_native_1.Text style={styles.miniText}>加好友</react_native_1.Text>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={styles.miniBtn} disabled={!friendOp.trim()} onPress={() => void friendAction('friend.remove', { target: friendOp.trim() }, '已移除好友')}>
          <react_native_1.Text style={styles.miniText}>删好友</react_native_1.Text>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={styles.miniBtnDanger} disabled={!friendOp.trim()} onPress={() => void friendAction('block.set', { target: friendOp.trim(), blocked: true }, '已屏蔽')}>
          <react_native_1.Text style={styles.miniText}>屏蔽</react_native_1.Text>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={styles.miniBtn} disabled={!friendOp.trim()} onPress={() => void friendAction('block.set', { target: friendOp.trim(), blocked: false }, '已取消屏蔽')}>
          <react_native_1.Text style={styles.miniText}>解除</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>
      <react_native_1.View style={styles.socialRow}>
        <react_native_1.TextInput style={styles.socialInput} value={requestId} onChangeText={setRequestId} placeholder="好友请求 ID（接受）" placeholderTextColor={theme_1.colors.faint}/>
        <react_native_1.Pressable style={styles.miniBtn} disabled={!requestId.trim()} onPress={() => void friendAction('friend.accept', { requestId: Number(requestId) }, '已接受好友请求')}>
          <react_native_1.Text style={styles.miniText}>接受好友</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', flex: 1, maxHeight: 620 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    scopeRow: { flexDirection: 'row', gap: 6 },
    scopeBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme_1.colors.primary },
    scopeBtnOn: { backgroundColor: theme_1.colors.primary },
    scopeText: { color: theme_1.colors.primaryText, fontSize: 13 },
    scopeTextOn: { color: '#FFFFFF' },
    refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: theme_1.colors.primary },
    refreshText: { color: theme_1.colors.primaryText, fontSize: 12 },
    peerInput: {
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        color: theme_1.colors.text,
        fontSize: 13,
        marginTop: 8,
    },
    error: { color: theme_1.colors.danger, fontSize: 13, marginTop: 8 },
    ok: { color: theme_1.colors.ok, fontSize: 13, marginTop: 8 },
    list: { marginTop: 10, flexGrow: 0 },
    msgRow: {
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginTop: 6,
    },
    msgFrom: { color: theme_1.colors.muted, fontSize: 11 },
    msgText: { color: theme_1.colors.text, fontSize: 14, marginTop: 2 },
    empty: { color: theme_1.colors.faint, fontSize: 13, marginTop: 10 },
    inputRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    input: {
        flex: 1,
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: theme_1.colors.text,
        fontSize: 15,
    },
    sendBtn: {
        backgroundColor: theme_1.colors.primary,
        borderRadius: 8,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    disabled: { opacity: 0.5 },
    socialRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
    socialInput: {
        flex: 1,
        backgroundColor: theme_1.colors.card,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: theme_1.colors.text,
        fontSize: 12,
    },
    miniBtn: { borderWidth: 1, borderColor: theme_1.colors.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
    miniBtnDanger: { borderWidth: 1, borderColor: theme_1.colors.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
    miniText: { color: theme_1.colors.primaryText, fontSize: 11 },
});
