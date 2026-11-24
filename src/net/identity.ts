export interface PlayerIdentity {
  uuid: string;
  name?: string;
}

/** 新版后端返回对象，旧版后端可能只返回 UUID。 */
export function normalizeIdentities(list: unknown): PlayerIdentity[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((item): PlayerIdentity[] => {
    if (typeof item === 'string') return item ? [{ uuid: item }] : [];
    if (!item || typeof item !== 'object' || typeof item.uuid !== 'string' || !item.uuid) return [];
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    return [name ? { uuid: item.uuid, name } : { uuid: item.uuid }];
  });
}

export function normalizeUuids(list: unknown): string[] {
  return normalizeIdentities(list).map(({ uuid }) => uuid);
}
