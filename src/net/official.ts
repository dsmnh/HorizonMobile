/**
 * 官方队伍投影与映射（契约 1.6.5 §8.8）的纯逻辑层：载荷归一化、状态判定与文案。
 * 后端 `team.official` / `team.map` 返回的字段可能缺省（旧库、映射指向的官方队伍已消失），
 * 屏幕层只消费这里的归一化结果，避免每处都写防御判断。
 */

/** `team.official` 的 links 元素：一条中央队伍 ↔ 官方队伍的绑定。 */
export interface OfficialLink {
  nodeId: number;
  worldRef: string;
  officialTeamId: string;
  gen: number;
  updatedAt: number;
  stale: boolean;
}

/** `team.official` 的 teams 元素：绑定的官方队伍当前投影。 */
export interface OfficialTeam {
  nodeId: number;
  worldRef: string;
  officialTeamId: string;
  gen: number;
  seq: number;
  ready: boolean;
  stale: boolean;
  name: string;
  owners: string[];
  officers: string[];
  members: string[];
}

/** `team.map` 的 candidates 元素：尚未绑定的候选官方队伍。 */
export interface MapCandidate {
  nodeId: number;
  worldRef: string;
  officialTeamId: string;
  name: string;
  reason: string;
}

/** 投影状态：可用于展示 / 需要提示重取 / 官方队伍已消失。 */
export type OfficialState = 'ok' | 'stale' | 'missing';

function texts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item !== '');
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 绑定槽位键：同一 (nodeId, worldRef) 只允许一个官方队伍。 */
export function slotKey(nodeId: number, worldRef: string): string {
  return `${nodeId}/${worldRef}`;
}

/** 官方队伍全键：后端投影表主键。 */
export function officialKey(nodeId: number, worldRef: string, officialTeamId: string): string {
  return `${nodeId}/${worldRef}/${officialTeamId}`;
}

export function normalizeLinks(raw: unknown): OfficialLink[] {
  if (!Array.isArray(raw)) return [];
  const out: OfficialLink[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const nodeId = num(row.nodeId, -1);
    const worldRef = typeof row.worldRef === 'string' ? row.worldRef : '';
    const officialTeamId = typeof row.officialTeamId === 'string' ? row.officialTeamId : '';
    if (nodeId < 0 || worldRef === '' || officialTeamId === '') continue;
    out.push({
      nodeId,
      worldRef,
      officialTeamId,
      gen: num(row.gen),
      updatedAt: num(row.updatedAt),
      stale: row.stale === true,
    });
  }
  return out;
}

export function normalizeTeams(raw: unknown): OfficialTeam[] {
  if (!Array.isArray(raw)) return [];
  const out: OfficialTeam[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const nodeId = num(row.nodeId, -1);
    const worldRef = typeof row.worldRef === 'string' ? row.worldRef : '';
    const officialTeamId = typeof row.officialTeamId === 'string' ? row.officialTeamId : '';
    if (nodeId < 0 || worldRef === '' || officialTeamId === '') continue;
    out.push({
      nodeId,
      worldRef,
      officialTeamId,
      gen: num(row.gen),
      seq: num(row.seq),
      ready: row.ready === true,
      stale: row.stale === true,
      name: typeof row.name === 'string' ? row.name : '',
      owners: texts(row.owners),
      officers: texts(row.officers),
      members: texts(row.members),
    });
  }
  return out;
}

export function normalizeCandidates(raw: unknown): MapCandidate[] {
  if (!Array.isArray(raw)) return [];
  const out: MapCandidate[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const nodeId = num(row.nodeId, -1);
    const worldRef = typeof row.worldRef === 'string' ? row.worldRef : '';
    const officialTeamId = typeof row.officialTeamId === 'string' ? row.officialTeamId : '';
    if (nodeId < 0 || worldRef === '' || officialTeamId === '') continue;
    out.push({
      nodeId,
      worldRef,
      officialTeamId,
      name: typeof row.name === 'string' ? row.name : '',
      reason: typeof row.reason === 'string' ? row.reason : '',
    });
  }
  return out;
}

/**
 * 投影是否可用：名字为空说明映射指向的官方队伍已从节点消失；
 * ready 为假或 stale 为真说明节点未加载该世界或上报过旧，需要重取而不是当作空队伍。
 */
export function officialState(team: OfficialTeam): OfficialState {
  if (team.name === '') return 'missing';
  if (!team.ready || team.stale) return 'stale';
  return 'ok';
}

export function stateLabel(state: OfficialState): string {
  if (state === 'missing') return '官方队伍已不存在';
  if (state === 'stale') return '投影已过期';
  return '已同步';
}

/** 候选推荐理由的展示文案；未知理由原样展示，便于排错。 */
export function reasonLabel(reason: string): string {
  if (reason === 'uuid-overlap') return '成员重合';
  if (reason === 'name-similar') return '同名';
  return reason === '' ? '候选' : reason;
}

/** 去重后的世界数量，用于页头概览。 */
export function worldCount(teams: OfficialTeam[]): number {
  return new Set(teams.map((team) => `${team.nodeId}/${team.worldRef}`)).size;
}

/** 角色名翻译：GTNHLib 允许一个玩家同时是 owner 与 member，故按集合判定。 */
export function rolesOf(team: OfficialTeam, uuid: string): string[] {
  const roles: string[] = [];
  if (team.owners.includes(uuid)) roles.push('owner');
  if (team.officers.includes(uuid)) roles.push('officer');
  if (team.members.includes(uuid)) roles.push('member');
  return roles;
}

/** 玩家在任一投影里出现的官方队伍键；用于「当前身份属于哪些官方队伍」。 */
export function teamsOfPlayer(teams: OfficialTeam[], uuid: string): OfficialTeam[] {
  if (uuid === '') return [];
  return teams.filter((team) => team.members.includes(uuid)
    || team.officers.includes(uuid) || team.owners.includes(uuid));
}

/**
 * 1.6.5 两个新错误码的用户可操作文案：官方队伍模式下中央队伍写入被拒，
 * 以及映射缺失/冲突。返回 null 表示不是这两个码，由调用方保留原始文案。
 */
export function officialErrorText(code: string): string | null {
  if (code === 'OFFICIAL_TEAM_MODE') {
    return '该身份只在官方队伍（GTNHLib）服上存在：队伍请用游戏内 /gtnhteam 管理，App 侧仅提供只读投影';
  }
  if (code === 'MAP_CONFLICT') {
    return '官方队伍映射缺失或冲突：请在本页确认绑定，或联系服主核对世界与队伍对应关系';
  }
  return null;
}
