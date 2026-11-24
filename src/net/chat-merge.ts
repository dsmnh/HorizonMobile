export interface ChatEventLike {
  k?: string;
  private?: boolean;
  from?: string;
  to?: string;
  text?: string;
  ts?: number;
  seq?: number;
  mid?: number | string;
  id?: number | string;
  fromName?: string;
  srv?: string;
  team?: string;
  world?: string;
}

export interface ChatMessage {
  mid: number | string;
  key: string;
  from: string;
  to?: string;
  text: string;
  ts?: number;
  name?: string;
  server?: string;
  team?: string;
  world?: string;
}

function normalize(event: ChatEventLike) {
  return {
    from: String(event.from ?? ''),
    to: event.to,
    text: String(event.text ?? ''),
    ts: typeof event.ts === 'number' && Number.isFinite(event.ts) ? event.ts : undefined,
    name: event.fromName || undefined,
    server: event.srv || undefined,
    team: event.team || undefined,
    world: event.world || undefined,
  };
}

export function fromHistory(message: ChatEventLike): ChatMessage {
  const mid = message.id ?? message.mid ?? message.seq ?? `h-${message.ts ?? 0}-${message.from ?? ''}`;
  return { ...normalize(message), mid, key: `history-${mid}` };
}

export function fromEvent(event: ChatEventLike, fallback: number): ChatMessage {
  const mid = event.mid ?? event.seq ?? fallback;
  return { ...normalize(event), mid, key: `event-${mid}-${event.ts ?? ''}` };
}

/** 历史 ID 与流序号属于不同序列，按载荷逐条配对并保留实时标签。 */
export function mergeHistory(history: ChatMessage[], current: ChatMessage[]): ChatMessage[] {
  const events = current.filter((message) => message.key.startsWith('event-'));
  const byKey = new Map(current.map((message) => [message.key, message]));
  const matched = new Set<string>();
  for (const message of history) {
    const same = events.find((event) => !matched.has(event.key) && event.ts === message.ts
      && event.from === message.from && event.to === message.to && event.text === message.text
      && event.server === message.server);
    if (same) {
      matched.add(same.key);
      byKey.delete(same.key);
    }
    const prior = byKey.get(message.key);
    byKey.set(message.key, { ...message, name: same?.name ?? prior?.name ?? message.name,
      team: same?.team ?? prior?.team ?? message.team, world: same?.world ?? prior?.world ?? message.world });
  }
  return [...byKey.values()].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).slice(-250);
}

export function isRelevant(e: ChatEventLike, scope: 'public' | 'private', peer: string, uuid: string): boolean {
  if (scope === 'public') return e.private !== true;
  const p = peer.trim();
  if (!p || e.private !== true) return false;
  if (e.from === p) return e.to === undefined || e.to === uuid;
  return e.from === uuid && e.to === p;
}
