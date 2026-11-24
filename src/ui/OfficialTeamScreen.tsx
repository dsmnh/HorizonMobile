/**
 * 官方队伍投影屏（契约 1.6.5 §8.8、1.6.6 §8.9）：GTNHLib 官方队伍的跨服视图与人工映射。
 * 协议面：team.info 取中央 teamId → team.official 拉投影 → team.map 取候选；
 * team.map.set / team.map.clear 仅服主/超管可用（后端裁决，FORBIDDEN 原样展示）。
 * 写入只开放邀请与接受两条官方动作：名单仍由 GTNHLib 维护，踢人、改角色、解散等只在游戏内进行；
 * 可能触发官方合队的接受操作必须先经 NEEDS_CONFIRM 让玩家确认任务归属变化。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from './theme';
import { Card, Chip, EmptyState, GhostButton, SectionLabel, StatusDot, StyledInput } from './components';
import { HorizonConn, type Res } from '../net/conn';
import {
  canInvite, needConfirmText, normalizeCandidates, normalizeLinks,
  normalizeTeams, officialErrorText, officialState, parseNeedConfirm, reasonLabel, rolesOf,
  slotKey, stateLabel, worldCount, type MapCandidate, type NeedConfirm, type OfficialLink,
  type OfficialTeam,
} from '../net/official';

export interface OfficialTeamScreenProps {
  conn: HorizonConn;
  uuid: string;
  onChanged?: () => void;
}

function roleText(role: string): string {
  return role === 'owner' ? '队长' : role === 'officer' ? '副队长' : '成员';
}

export function OfficialTeamScreen({ conn, uuid, onChanged }: OfficialTeamScreenProps): JSX.Element {
  const [teamId, setTeamId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('');
  const [links, setLinks] = useState<OfficialLink[]>([]);
  const [teams, setTeams] = useState<OfficialTeam[]>([]);
  const [candidates, setCandidates] = useState<MapCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  /** 邀请目标 UUID 输入；空串表示不邀请。 */
  const [inviteTarget, setInviteTarget] = useState('');
  /** 待确认的合队信息：非空时该官方队伍展示确认条并暂停接受。 */
  const [pending, setPending] = useState<{ team: OfficialTeam; info: NeedConfirm } | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const info: Res = await conn.req('team.info', { uuid });
      if (!info.ok && info.m && info.m !== 'NOT_IN_TEAM') {
        setError(info.m);
        setLoaded(true);
        return;
      }
      const id = info.ok && info.b?.team ? info.b.team.teamId : undefined;
      if (typeof id !== 'number') {
        setTeamId(null);
        setTeamName('');
        setLinks([]);
        setTeams([]);
        setCandidates([]);
        setLoaded(true);
        return;
      }
      setTeamId(id);
      setTeamName(String(info.b.team.name ?? ''));
      const [official, map] = await Promise.all([
        conn.req('team.official', { uuid, teamId: id }),
        conn.req('team.map', { uuid, teamId: id }),
      ]);
      if (!official.ok) {
        setError(official.m ?? 'team.official 失败');
      } else {
        setLinks(normalizeLinks(official.b?.links));
        setTeams(normalizeTeams(official.b?.teams));
      }
      if (map.ok) {
        setCandidates(normalizeCandidates(map.b?.candidates));
      } else if (map.m && map.m !== 'FORBIDDEN') {
        setError(map.m);
      }
      setLoaded(true);
    } catch (e: any) {
      setError(e.message ?? String(e));
      setLoaded(true);
    }
  }, [conn, uuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (op: string, p: Record<string, unknown>, doneText: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const res: Res = await conn.req(op, { uuid, ...p });
      if (res.ok) {
        setOkMsg(doneText);
        if (mounted.current) onChanged?.();
        await load();
      } else {
        setError(`${op}: ${res.m ?? '失败'}`);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  /** 官方写入的统一收口：错误码走 officialErrorText，NEEDS_CONFIRM 转确认条。 */
  const write = async (op: string, team: OfficialTeam, extra: Record<string, unknown>,
      doneText: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const res: Res = await conn.req(op, {
        uuid, teamId, nodeId: team.nodeId, worldRef: team.worldRef,
        officialTeamId: team.officialTeamId, ...extra,
      });
      if (res.ok) {
        setOkMsg(doneText);
        setPending(null);
        if (mounted.current) onChanged?.();
        await load();
        return true;
      }
      const confirm = parseNeedConfirm(res.b);
      if (confirm != null) {
        setPending({ team, info: confirm });
        return false;
      }
      const friendly = officialErrorText(res.m ?? '');
      setError(`${op}: ${friendly ?? res.m ?? '失败'}`);
      return false;
    } catch (e: any) {
      setError(e.message ?? String(e));
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const invite = (team: OfficialTeam) => {
    const target = inviteTarget.trim();
    if (target === '') {
      setError('请先填写要邀请的玩家 UUID');
      return;
    }
    void write('team.official.invite', team, { targetUuid: target }, `已下发邀请：${target}`);
  };

  const accept = (team: OfficialTeam, confirm: boolean) => {
    void write('team.official.accept', team, { confirm }, '已下发接受入队请求');
  };

  const bind = (candidate: MapCandidate) => {
    if (teamId == null) return;
    void run('team.map.set', {
      teamId, nodeId: candidate.nodeId, worldRef: candidate.worldRef,
      officialTeamId: candidate.officialTeamId,
    }, `已绑定 ${candidate.name || candidate.officialTeamId}`);
  };

  const unbind = (link: OfficialLink) => {
    if (teamId == null) return;
    void run('team.map.clear', {
      teamId, nodeId: link.nodeId, worldRef: link.worldRef,
    }, '已取消绑定');
  };

  const heading = teamName ? `官方队伍 · ${teamName}` : '官方队伍';

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.sub}>官方队伍投影只读；邀请与接受走官方动作，其余管理在游戏内进行</Text>
        </View>
        <GhostButton label={busy ? '刷新中…' : '刷新'} icon="refresh" tone="neutral"
          disabled={busy} onPress={() => void load()} />
      </View>

      {error !== '' && (
        <View style={[styles.msgBox, { backgroundColor: colors.badSoft, borderColor: colors.bad + '55' }]}>
          <Text style={[styles.msgText, { color: colors.bad }]}>{error}</Text>
        </View>
      )}
      {okMsg !== '' && (
        <View style={[styles.msgBox, { backgroundColor: colors.okSoft, borderColor: colors.ok + '55' }]}>
          <Text style={[styles.msgText, { color: colors.ok }]}>{okMsg}</Text>
        </View>
      )}

      {!loaded && <EmptyState icon="hourglass-outline" title="正在读取官方队伍投影" />}

      {loaded && teamId == null && (
        <EmptyState icon="people-outline" title="尚未加入中央队伍"
          subtitle="官方队伍需先有对应中央队伍，再由服主确认映射" />
      )}

      {loaded && teamId != null && teams.length === 0 && (
        <EmptyState icon="link-outline" title="尚未绑定官方队伍"
          subtitle="在下方候选中选择本队伍对应的官方队伍，由服主或超管确认" />
      )}

      {teams.length > 0 && (
        <SectionLabel text={`已绑定 ${teams.length} 处 · ${worldCount(teams)} 个世界`}
          right={<Chip label="team.official" tone="accent2" />} />
      )}

      {teams.map((team) => {
        const state = officialState(team);
        return (
          <Card key={`${team.nodeId}/${team.worldRef}/${team.officialTeamId}`} style={{ marginTop: spacing.m }}>
            <View style={styles.teamHead}>
              <Text style={styles.teamName}>{team.name || team.officialTeamId}</Text>
              <Chip label={stateLabel(state)} tone={state === 'ok' ? 'ok' : state === 'stale' ? 'warn' : 'bad'} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>节点</Text>
              <Text style={styles.metaValue}>{team.nodeId}</Text>
              <Text style={styles.metaLabel}>世界</Text>
              <Text style={styles.metaValue}>{team.worldRef}</Text>
              <Text style={styles.metaLabel}>代次</Text>
              <Text style={styles.metaValue}>{team.gen} · {team.seq}</Text>
            </View>
            <View style={styles.roleRow}>
              <Text style={styles.metaLabel}>队长 {team.owners.length}</Text>
              <Text style={styles.metaLabel}>副队长 {team.officers.length}</Text>
              <Text style={styles.metaLabel}>成员 {team.members.length}</Text>
            </View>
            {team.owners.map((owner) => (
              <Text key={`o-${owner}`} style={styles.member}>{owner} · {roleText('owner')}</Text>
            ))}
            {team.officers.filter((officer) => !team.owners.includes(officer)).map((officer) => (
              <Text key={`f-${officer}`} style={styles.member}>{officer} · {roleText('officer')}</Text>
            ))}
            {team.members
              .filter((member) => !team.owners.includes(member) && !team.officers.includes(member))
              .map((member) => (
                <Text key={`m-${member}`} style={styles.member}>
                  {member} · {roleText('member')}{rolesOf(team, uuid).includes('member') && member === uuid ? '（当前身份）' : ''}
                </Text>
              ))}
            {pending != null && pending.team.officialTeamId === team.officialTeamId
              && pending.team.worldRef === team.worldRef && (
              <View style={[styles.msgBox, { backgroundColor: colors.warnSoft, borderColor: colors.warn + '55' }]}>
                <Text style={[styles.msgText, { color: colors.warn }]}>{needConfirmText(pending.info)}</Text>
                <View style={styles.actRow}>
                  <GhostButton label="确认接受并合队" icon="checkmark-outline" tone="bad" disabled={busy}
                    onPress={() => accept(team, true)} />
                  <GhostButton label="取消" icon="close-outline" tone="neutral" disabled={busy}
                    onPress={() => setPending(null)} />
                </View>
              </View>
            )}
            {canInvite(team, uuid) && (
              <View style={styles.inviteRow}>
                <View style={{ flex: 1 }}>
                  <StyledInput value={inviteTarget} onChangeText={setInviteTarget}
                    placeholder="被邀请玩家的 UUID" />
                </View>
                <GhostButton label="邀请" icon="person-add-outline" tone="accent" disabled={busy}
                  onPress={() => invite(team)} />
              </View>
            )}
            <View style={styles.actRow}>
              <GhostButton label="接受邀请入队" icon="enter-outline" tone="accent" disabled={busy}
                onPress={() => accept(team, false)} />
              <GhostButton label="取消绑定" icon="unlink-outline" tone="neutral" disabled={busy}
                onPress={() => unbind({
                  nodeId: team.nodeId, worldRef: team.worldRef, officialTeamId: team.officialTeamId,
                  gen: team.gen, updatedAt: 0, stale: team.stale,
                })} />
            </View>
          </Card>
        );
      })}

      {links.length > 0 && (
        <View style={styles.linkHint}>
          <StatusDot ok />
          <Text style={styles.hint} numberOfLines={2}>
            映射 {links.map((link) => slotKey(link.nodeId, link.worldRef)).join('、')}
          </Text>
        </View>
      )}

      {candidates.length > 0 && (
        <>
          <SectionLabel text="候选官方队伍" right={<Chip label="team.map" tone="accent2" />} />
          <Card>
            <Text style={styles.hint}>按成员 UUID 重合与同名推荐，仅在服主确认后生效；一个世界内一支官方队伍只能对应一个中央队伍。</Text>
            {candidates.map((candidate) => (
              <View key={`${candidate.nodeId}/${candidate.worldRef}/${candidate.officialTeamId}`} style={styles.candRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName} numberOfLines={1}>{candidate.name || candidate.officialTeamId}</Text>
                  <Text style={styles.metaLabel} numberOfLines={1}>
                    节点 {candidate.nodeId} · {candidate.worldRef} · {reasonLabel(candidate.reason)}
                  </Text>
                </View>
                <GhostButton label="绑定" icon="link-outline" tone="accent" disabled={busy}
                  onPress={() => bind(candidate)} />
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  msgBox: { marginTop: spacing.m, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  msgText: { fontSize: 12, lineHeight: 17 },
  teamHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.s },
  teamName: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.s, marginTop: spacing.s, flexWrap: 'wrap' },
  metaLabel: { color: colors.textFaint, fontSize: 11 },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  roleRow: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.s },
  member: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 2 },
  actRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
  linkHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.m },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 18, flex: 1 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.s },
  candRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.m },
}));
