/**
 * 连接信息持久化（@react-native-async-storage/async-storage）：
 * 上次成功的后端地址与账号名，登录屏预填。存取失败静默降级（不阻塞登录流程）。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'horizon.conn.last';

export interface LastConn {
  host: string;
  port: number;
  name: string;
}

export async function loadLastConn(): Promise<LastConn | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v.host === 'string' && typeof v.port === 'number' && typeof v.name === 'string') {
      return v as LastConn;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveLastConn(v: LastConn): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // 持久化失败不阻塞主流程
  }
}
