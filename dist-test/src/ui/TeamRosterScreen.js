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
exports.TeamRosterScreen = TeamRosterScreen;
/**
 * 队伍成员与审批屏（迁移适配指南 §TeamScreen 补全，契约 1.5.0 §team）：
 * team.info 渲染成员（uuid+role），行内 kick/transfer/setRole；invite（目标 UUID）与
 * acceptInvite/declineInvite（邀请 ID）、apply（队伍 ID）、approveApply/denyApply（申请 ID）。
 * 权限差异由后端裁决（FORBIDDEN 原样展示）；队长独有 disband/transfer（企划书 04 权限口径）。
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
function TeamRosterScreen({ conn, uuid, onChanged }) {
    const [members, setMembers] = (0, react_1.useState)([]);
    const [teamId, setTeamId] = (0, react_1.useState)(null);
    const [inviteTarget, setInviteTarget] = (0, react_1.useState)('');
    const [inviteId, setInviteId] = (0, react_1.useState)('');
    const [applyTeamId, setApplyTeamId] = (0, react_1.useState)('');
    const [applyId, setApplyId] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    const [okMsg, setOkMsg] = (0, react_1.useState)('');
    const load = (0, react_1.useCallback)(async () => {
        setError('');
        try {
            const res = await conn.req('team.info', { uuid });
            if (res.ok && res.b?.team) {
                const team = res.b.team;
                setTeamId(team.teamId ?? null);
                setMembers(Array.isArray(team.members)
                    ? team.members.map((m) => ({ uuid: String(m.uuid), role: String(m.role) }))
                    : []);
            }
            else if (res.ok) {
                setMembers([]);
                setTeamId(null);
            }
            else {
                setMembers([]);
                setTeamId(null);
                if (res.m && res.m !== 'NOT_IN_TEAM')
                    setError(res.m);
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
    }, [conn, uuid]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    const run = async (op, p, doneText) => {
        if (busy)
            return;
        setBusy(true);
        setError('');
        setOkMsg('');
        try {
            const res = await conn.req(op, { uuid, ...p });
            if (res.ok) {
                setOkMsg(doneText);
                onChanged?.();
                await load();
            }
            else {
                setError(`${op}: ${res.m ?? '失败'}`);
            }
        }
        catch (e) {
            setError(e.message ?? String(e));
        }
        finally {
            setBusy(false);
        }
    };
    const isLeader = members.some((m) => m.uuid === uuid && m.role === 'leader');
    return (<react_native_1.View style={styles.card}>
      <react_native_1.View style={styles.headerRow}>
        <react_native_1.Text style={styles.title}>成员与审批{teamId != null ? `（队伍 ${teamId}）` : ''}</react_native_1.Text>
        <react_native_1.Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <react_native_1.Text style={styles.refreshText}>刷新</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      {members.map((m) => (<react_native_1.View key={m.uuid} style={styles.memberRow}>
          <react_native_1.View style={styles.memberMeta}>
            <react_native_1.Text style={styles.memberUuid} numberOfLines={1}>{m.uuid}</react_native_1.Text>
            <react_native_1.Text style={styles.memberRole}>
              {m.role === 'leader' ? '队长' : m.role === 'vice' ? '副队长' : '成员'}
            </react_native_1.Text>
          </react_native_1.View>
          <react_native_1.View style={styles.memberActions}>
            {m.role !== 'leader' && (<>
                <react_native_1.Pressable style={styles.miniBtn} disabled={busy} onPress={() => void run('team.setRole', { target: m.uuid, role: 'vice' }, '已设为副队长')}>
                  <react_native_1.Text style={styles.miniText}>副</react_native_1.Text>
                </react_native_1.Pressable>
                <react_native_1.Pressable style={styles.miniBtn} disabled={busy} onPress={() => void run('team.setRole', { target: m.uuid, role: 'member' }, '已设为成员')}>
                  <react_native_1.Text style={styles.miniText}>员</react_native_1.Text>
                </react_native_1.Pressable>
              </>)}
            {m.uuid !== uuid && (<>
                <react_native_1.Pressable style={styles.miniBtn} disabled={busy} onPress={() => void run('team.kick', { target: m.uuid }, '已移出')}>
                  <react_native_1.Text style={styles.miniText}>移出</react_native_1.Text>
                </react_native_1.Pressable>
                {isLeader && (<react_native_1.Pressable style={styles.miniBtn} disabled={busy} onPress={() => void run('team.transfer', { target: m.uuid }, '已转让队长')}>
                    <react_native_1.Text style={styles.miniText}>转让</react_native_1.Text>
                  </react_native_1.Pressable>)}
              </>)}
          </react_native_1.View>
        </react_native_1.View>))}

      <react_native_1.View style={styles.idRow}>
        <react_native_1.TextInput style={styles.input} value={inviteId} onChangeText={setInviteId} placeholder="邀请 ID（收到的邀请）" placeholderTextColor="#5A6B8C" editable={!busy}/>
        <react_native_1.Pressable style={styles.btn} disabled={busy || !inviteId.trim()} onPress={() => void run('team.acceptInvite', { inviteId: Number(inviteId) }, '已接受邀请')}>
          <react_native_1.Text style={styles.btnText}>接受</react_native_1.Text>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={styles.btnSecondary} disabled={busy || !inviteId.trim()} onPress={() => void run('team.declineInvite', { inviteId: Number(inviteId) }, '已谢绝')}>
          <react_native_1.Text style={styles.btnSecondaryText}>谢绝</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      <react_native_1.View style={styles.idRow}>
        <react_native_1.TextInput style={styles.input} value={applyTeamId} onChangeText={setApplyTeamId} placeholder="队伍 ID（申请加入公开队伍）" placeholderTextColor="#5A6B8C" editable={!busy}/>
        <react_native_1.Pressable style={styles.btn} disabled={busy || !applyTeamId.trim()} onPress={() => void run('team.apply', { teamId: Number(applyTeamId) }, '申请已提交')}>
          <react_native_1.Text style={styles.btnText}>申请</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      <react_native_1.View style={styles.idRow}>
        <react_native_1.TextInput style={styles.input} value={applyId} onChangeText={setApplyId} placeholder="申请 ID（审批）" placeholderTextColor="#5A6B8C" editable={!busy}/>
        <react_native_1.Pressable style={styles.btn} disabled={busy || !applyId.trim()} onPress={() => void run('team.approveApply', { applyId: Number(applyId) }, '已批准')}>
          <react_native_1.Text style={styles.btnText}>批准</react_native_1.Text>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={styles.btnSecondary} disabled={busy || !applyId.trim()} onPress={() => void run('team.denyApply', { applyId: Number(applyId) }, '已拒绝')}>
          <react_native_1.Text style={styles.btnSecondaryText}>拒绝</react_native_1.Text>
        </react_native_1.Pressable>
      </react_native_1.View>

      {error !== '' && <react_native_1.Text style={styles.error}>{error}</react_native_1.Text>}
      {okMsg !== '' && <react_native_1.Text style={styles.ok}>{okMsg}</react_native_1.Text>}
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    card: { width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 14 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: '#E8EEF9', fontSize: 16, fontWeight: '600' },
    refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#2E6BE6' },
    refreshText: { color: '#6E9BF0', fontSize: 12 },
    memberRow: {
        backgroundColor: '#16203A',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    memberMeta: { flex: 1, marginRight: 8 },
    memberUuid: { color: '#E8EEF9', fontSize: 12 },
    memberRole: { color: '#8FA3C7', fontSize: 11, marginTop: 2 },
    memberActions: { flexDirection: 'row', gap: 6 },
    miniBtn: { borderWidth: 1, borderColor: '#2E6BE6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    miniText: { color: '#6E9BF0', fontSize: 11 },
    idRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
    input: {
        flex: 1,
        backgroundColor: '#16203A',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: '#E8EEF9',
        fontSize: 13,
    },
    btn: { backgroundColor: '#2E6BE6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
    btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    btnSecondary: { borderWidth: 1, borderColor: '#2E6BE6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
    btnSecondaryText: { color: '#6E9BF0', fontSize: 13 },
    error: { color: '#E46A6A', fontSize: 12, marginTop: 8 },
    ok: { color: '#4CC38A', fontSize: 12, marginTop: 8 },
});
