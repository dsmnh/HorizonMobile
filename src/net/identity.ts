/**
 * account.uuids / 会话结果的绑定身份归一化：契约 1.6.0 §8.7 起条目是 {uuid, name} 对象，
 * 更早的实现直接给字符串。UI 只消费 uuid 字符串，这里统一收敛，避免把对象渲染进列表。
 */
export function normalizeUuids(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      if (item) out.push(item);
    } else if (item && typeof item === 'object') {
      const uuid = (item as { uuid?: unknown }).uuid;
      if (typeof uuid === 'string' && uuid) out.push(uuid);
    }
  }
  return out;
}
