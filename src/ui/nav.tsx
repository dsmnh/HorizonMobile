/**
 * 导航骨架（迁移适配指南 §屏幕接线深化）：AppContext + NativeStack 六路由。
 * 屏幕组件保持 props 无感（路由包装层从 context 取值下传），后续按需拆分更多路由。
 */
import { createContext, useContext } from 'react';
import type { HorizonConn, Res } from '../net/conn';
import type { PlayerIdentity } from '../net/identity';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export interface AppState {
  conn: HorizonConn | null;
  account: string;
  activeUuid: string;
  setActiveUuid: (uuid: string) => void;
  connected: boolean;
  identities: PlayerIdentity[];
  setIdentities: (identities: PlayerIdentity[]) => void;
  uuids: string[];
  authenticate: (
    host: string,
    port: number,
    mode: 'login' | 'register',
    name: string,
    pass: string,
    tls: boolean,
  ) => Promise<void>;
  /** 预鉴权重设密码；返回空字符串表示成功，否则为错误文案。 */
  resetPassword: (
    host: string,
    port: number,
    recoverCode: string,
    newPassword: string,
    tls: boolean,
  ) => Promise<string>;
  disconnect: () => void;
  busy: boolean;
  error: string;
}

export const AppContext = createContext<AppState>({
  conn: null,
  account: '',
  activeUuid: '',
  setActiveUuid: () => undefined,
  connected: false,
  identities: [],
  setIdentities: () => undefined,
  uuids: [],
  authenticate: async () => undefined,
  resetPassword: async () => '未连接后端',
  disconnect: () => undefined,
  busy: false,
  error: '',
});

export function useApp(): AppState {
  return useContext(AppContext);
}

export type MainTabParamList = {
  Home: undefined;
  Storage: undefined;
  Chat: undefined;
  Tools: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Bind: undefined;
  Team: undefined;
  ChatStyle: undefined;
  Session: undefined;
  Monitor: undefined;
  ServerTools: undefined;
  Profile: undefined;
  Bq: undefined;
  Settings: undefined;
};

export type RootStackProps<T extends keyof RootStackParamList = keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** 请求响应的便捷重导出（屏幕层统一从这里取 Res 类型）。 */
export type { Res };
