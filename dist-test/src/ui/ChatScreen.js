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
 * 聊天屏基础版（迁移适配指南 §ChatScreen，阶段 3 公共频道）：
 * chat.history 拉取 + chat 流实时事件 + chat.public.send 发送。
 * 好友/私聊选择器与屏蔽管理随后续迁移增量（guide §ChatScreen 工作量=大）。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("../ui/theme");
function ChatScreen({ conn, uuid }) {
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [draft, setDraft] = (0, react_1.useState)('');
    const [error, setError] = (0, react_1.useState)('');
    const [sending, setSending] = (0, react_1.useState)(false);
    const streamRef = (0, react_1.useRef)(null);
    const listRef = (0, react_1.useRef)(null);
    const loadHistory = (0, react_1.useCallback)(async () => {
        setError('');
        try {
            const res = await conn.req('chat.history', { uuid, scope: 'public', limit: 50 });
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
    const send = (0, react_1.useCallback)(async () => {
        const text = draft.trim();
        if (!text || sending)
            return;
        setSending(true);
        setError('');
        try {
            const res = await conn.req('chat.public.send', { uuid, text });
            if (!res.ok) {
                setError(res.m ?? '发送失败');
            }
            else {
                setDraft('');
                // 发送者自身经 chat 流收到回显事件；此处不再本地追加，避免双份
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
        finally {
            setSending(false);
        }
    }, [conn, uuid, draft, sending]);
    return (<react_native_1.View style={styles.card}>
      <react_native_1.View style={styles.headerRow}>
        <react_native_1.Text style={styles.title}>公共频道</react_native_1.Text>
        <react_native_1.Pressable style={styles.refreshBtn} onPress={() => void loadHistory()}>
          <react_native_1.Text style={styles.refreshText}>历史</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}

      <react_native_1.FlatList ref={listRef} data={messages} keyExtractor={(m) => String(m.mid)} style={styles.list} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })} renderItem={({ item }) => (<react_native_1.View style={styles.msgRow}>
            <react_native_1.Text style={styles.msgFrom} numberOfLines={1}>{item.from}</react_native_1.Text>
            <react_native_1.Text style={styles.msgText}>{item.text}</react_native_1.Text>
          </react_native_1.View>)} ListEmptyComponent={<react_native_1.Text style={styles.empty}>暂无消息。</react_native_1.Text>}/>

      <react_native_1.View style={styles.inputRow}>
        <react_native_1.TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder="发送到公共频道…" placeholderTextColor="#5A6B8C" editable={!sending} onSubmitEditing={() => void send()}/>
        <react_native_1.Pressable style={[styles.sendBtn, sending && styles.disabled]} disabled={sending} onPress={() => void send()}>
          <react_native_1.Text style={styles.sendText}>发送</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', flex: 1, maxHeight: 520 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: theme_1.colors.text, fontSize: 20, fontWeight: '700' },
    refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: theme_1.colors.primary },
    refreshText: { color: theme_1.colors.primaryText, fontSize: 12 },
    error: { color: theme_1.colors.danger, fontSize: 13, marginTop: 8 },
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
});
