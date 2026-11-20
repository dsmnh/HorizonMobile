/**
 * ME 共享载荷构造（契约 1.6.0 §8.5）：me.share 与 me.unshare 都按目标 UUID 定位条目，
 * 后端缺 target 会以 BAD_PARAMS 拒绝，故两者共用同一份构造避免再次漏传。
 */
export interface MeSharePayload {
  uuid: string;
  deviceId: string;
  target: string;
  level: string;
}

export interface MeUnsharePayload {
  uuid: string;
  deviceId: string;
  target: string;
}

export function sharePayload(uuid: string, deviceId: string, target: string, level = 'control'): MeSharePayload {
  return { uuid, deviceId: deviceId.trim(), target: target.trim(), level };
}

export function unsharePayload(uuid: string, deviceId: string, target: string): MeUnsharePayload {
  return { uuid, deviceId: deviceId.trim(), target: target.trim() };
}
