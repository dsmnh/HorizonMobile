/**
 * 导航骨架（迁移适配指南 §屏幕接线深化）：AppContext + NativeStack 六路由。
 * 屏幕组件保持 props 无感（路由包装层从 context 取值下传），后续按需拆分更多路由。
 */
import { createContext, useContext } from 'react';
import type { HorizonConn, Res } from '../net/conn';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export interface AppState {
  conn: HorizonConn | null;
  connected: boolean;
  uuids: string[];
  setUuids: (uuids: string[]) => void;
  authenticate: (
    host: string,
    port: number,
    mode: 'login' | 'register',
    name: string,
    pass: string,
  ) => Promise<void>;
  disconnect: () => void;
  busy: boolean;
  error: string;
}

export const AppContext = createContext<AppState>({
  conn: null,
  connected: false,
  uuids: [],
  setUuids: () => undefined,
  authenticate: async () => undefined,
  disconnect: () => undefined,
  busy: false,
  error: '',
});

export function useApp(): AppState {
  return useContext(AppContext);
}

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Team: undefined;
  Chat: undefined;
  Monitor: undefined;
  Session: undefined;
};

export type RootStackProps<T extends keyof RootStackParamList = keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** 请求响应的便捷重导出（屏幕层统一从这里取 Res 类型）。 */
export type { Res };
