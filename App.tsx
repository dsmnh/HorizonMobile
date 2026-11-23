/**
 * App 根入口（Expo 51 / React 18）：NativeStack 九路由。
 * 协议面：预鉴权 account.login/register（src/net/preauth.ts）→ HorizonConn 会话 → 各功能屏。
 * 外观：主题取自 src/ui/theme（对齐 AEMobileApp 调色板），深浅色选择持久化在 AsyncStorage。
 */
import './src/net/buffer-global';
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HorizonConn, type Transport } from './src/net/conn';
import { RnTransport } from './src/net/transport-rn';
import { preauthOp } from './src/net/preauth';
import { normalizeUuids } from './src/net/identity';
import { saveLastConn } from './src/ui/lastConn';
import { AppContext, type RootStackParamList } from './src/ui/nav';
import { LoginRoute, HomeRoute, TeamRoute, ChatRoute, MonitorRoute, SessionRoute, MeRoute, BqRoute, SettingsRoute } from './src/ui/routes';
import { setThemeMode, useTheme, type ThemeMode } from './src/ui/theme';

const THEME_KEY = 'horizon.theme.mode';

/** 终止性错误（不重连）的用户可操作文案；非已知码返回 null，由调用方保留原始文案。 */
function fatalText(code: string): string | null {
  if (code === 'CERT_FINGERPRINT_MISMATCH') {
    return '证书指纹与已信任记录不一致：如服务端确实更换过证书，请在下方「重置已信任证书」后重新登录';
  }
  if (code === 'PIN_STORE_FAILED') {
    return '无法保存证书指纹（本地存储不可用），已拒绝连接以免每次重新信任';
  }
  if (code === 'TLS_FLAGS_MISMATCH') {
    return 'TLS 帧标记与连接不一致（疑似降级剥离），已按契约 §9.1 断开';
  }
  return null;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): JSX.Element {
  const { colors, mode } = useTheme();
  const [conn, setConn] = useState<HorizonConn | null>(null);
  const [connected, setConnected] = useState(false);
  const [uuids, setUuids] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 主题：启动时读回上次选择，之后每次变更写回（失败忽略，退回深色即可）
  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark') setThemeMode(v as ThemeMode);
    });
  }, []);
  useEffect(() => {
    void AsyncStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  // conn 的常驻重连循环自动恢复；这里只把 isConnected 的可见状态以低频同步到 UI
  useEffect(() => {
    if (!conn) return undefined;
    const t = setInterval(() => setConnected(conn.isConnected), 2000);
    return () => clearInterval(t);
  }, [conn]);

  useEffect(() => () => conn?.close(), [conn]);

  const authenticate = useCallback(
    async (host: string, port: number, mode: 'login' | 'register', name: string, pass: string, tls: boolean) => {
      setBusy(true);
      setError('');
      // 预鉴权与会话共用同一 TLS 判定：后端 App 平面启用 TLS 时明文连接会被直接断开（契约 §9.1）
      const tlsOpts = tls ? { enabled: true } : undefined;
      try {
        const res = await preauthOp(new RnTransport() as Transport, host, port,
          mode === 'login' ? 'account.login' : 'account.register', { name, pass }, 15_000, tlsOpts);
        // 会话结果里的绑定身份同样是对象条目，登录后直接归一化，省一次 account.uuids 往返
        setUuids(normalizeUuids(res.b?.uuids));
        if (!res.ok || !res.b?.token) {
          setError(res.m ?? '鉴权失败');
          return;
        }
        void saveLastConn({ host, port, name, tls });
        const c = new HorizonConn(new RnTransport() as Transport, {
          host, port, token: res.b.token, tls,
          onFatal: (code) => {
            // 终止性错误（指纹变化、帧标记降级）不自动重连，必须给出可操作提示
            setError(fatalText(code) ?? `连接终止：${code}`);
            setConn(null);
            setConnected(false);
          },
        });
        await c.start();
        const u = await c.req('account.uuids');
        setUuids(u.ok ? normalizeUuids(u.b?.uuids) : []);
        setConn(c);
        setConnected(true);
      } catch (e: any) {
        // 预鉴权阶段的终止性错误（如服务端换证导致指纹不匹配）同样换成可操作文案
        const msg = String((e && e.message) ?? e ?? '');
        setError(fatalText(msg) ?? (msg || '未知异常'));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** 恢复码重设密码属预鉴权 op；成功后后端注销该账号全部会话。 */
  const resetPassword = useCallback(
    async (host: string, port: number, recoverCode: string, newPassword: string, tls: boolean) => {
      try {
        const res = await preauthOp(new RnTransport() as Transport, host, port,
          'account.resetPassword', { recoverCode, newPassword }, 15_000, tls ? { enabled: true } : undefined);
        return res.ok ? '' : (res.m ?? '重设密码失败');
      } catch (e: any) {
        return String(e.message ?? e);
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    conn?.close();
    setConn(null);
    setConnected(false);
    setUuids([]);
  }, [conn]);

  // 导航主题与页面底色跟随调色板；主题切换时以 key 重挂，避免残留旧色板缓存
  const navTheme: Theme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent2,
    },
  };

  return (
    <AppContext.Provider value={{ conn, connected, uuids, setUuids, authenticate, resetPassword, disconnect, busy, error }}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <NavigationContainer theme={navTheme} key={mode}>
        <Stack.Navigator
          initialRouteName={conn ? 'Home' : 'Login'}
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontSize: 16, fontWeight: '600' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="Login" component={LoginRoute} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeRoute} options={{ headerShown: false }} />
          <Stack.Screen name="Team" component={TeamRoute} options={{ title: '队伍' }} />
          <Stack.Screen name="Chat" component={ChatRoute} options={{ title: '聊天' }} />
          <Stack.Screen name="Monitor" component={MonitorRoute} options={{ title: '监控' }} />
          <Stack.Screen name="Session" component={SessionRoute} options={{ title: '会话' }} />
          <Stack.Screen name="Me" component={MeRoute} options={{ title: 'ME 设备' }} />
          <Stack.Screen name="Bq" component={BqRoute} options={{ title: 'BQ 同步' }} />
          <Stack.Screen name="Settings" component={SettingsRoute} options={{ title: '设置' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppContext.Provider>
  );
}
