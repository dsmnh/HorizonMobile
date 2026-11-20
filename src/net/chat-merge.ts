/**
 * 聊天消息归一化：历史条目与流事件的键名不同（历史用 id，事件用 seq），
 * 公聊事件无 scope 字段、私聊事件以 private:true 标记，判定集中在此便于测试。
 */

export interface ChatEventLike {
  k?: string;
  private?: boolean;
  from?: string;
  to?: string;
  text?: string;
  ts?: number;
  seq?: number;
  mid?: number | string;
}

/** 历史条目转 UI 结构；服务端历史用 id，缺失时退回序号。 */
export function fromHistory(m: any): { mid: number | string; from: string; text: string; ts?: number } {
  const mid = m?.id ?? m?.mid;
  return {
    mid: mid === undefined || mid === null ? `h-${m?.ts ?? 0}-${String(m?.from ?? '')}` : mid,
    from: String(m?.from ?? ''),
    text: String(m?.text ?? ''),
    ts: typeof m?.ts === 'number' ? m.ts : undefined,
  };
}

/** 流事件转 UI 结构；私聊缺 id 时用序号兜底，避免多条消息共用同一 key。 */
export function fromEvent(e: ChatEventLike, seq: number): { mid: number | string; from: string; text: string; ts?: number } {
  const mid = e.mid ?? e.seq ?? seq;
  return {
    mid,
    from: String(e.from ?? ''),
    text: String(e.text ?? ''),
    ts: e.ts,
  };
}

/** 事件是否属于当前频道：公聊看 private 位，私聊看收发双方。 */
export function isRelevant(e: ChatEventLike, scope: 'public' | 'private', peer: string, uuid: string): boolean {
  if (scope === 'public') return e.private !== true;
  const p = peer.trim();
  if (!p) return false;
  return e.private === true && (e.from === p || e.to === p || e.from === uuid);
}
