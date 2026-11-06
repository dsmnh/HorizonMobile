/**
 * App 根入口（Expo 51 / React 18）：NativeStack 六路由。
 * 协议面：预鉴权 account.login/register（src/net/preauth.ts）→ HorizonConn 会话 → 各功能屏。
 * 旧底座入口（SQLiteProvider/导航/主题）归档于 src-app-legacy/AppEntry.legacy.tsx。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HorizonConn, type Transport } from './src/net/conn';
import { RnTransport } from './src/net/transport-rn';
import { preauthOp } from './src/net/preauth';
import { saveLastConn } from './src/ui/lastConn';
import { AppContext, type RootStackParamList } from './src/ui/nav';
import { LoginRoute, HomeRoute, TeamRoute, ChatRoute, MonitorRoute, SessionRoute } from './src/ui/routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): JSX.Element {
  const [conn, setConn] = useState<HorizonConn | null>(null);
  const [connected, setConnected] = useState(false);
  const [uuids, setUuids] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // conn 的常驻重连循环自动恢复；这里只把 isConnected 的可见状态以低频同步到 UI
  useEffect(() => {
    if (!conn) return undefined;
    const t = setInterval(() => setConnected(conn.isConnected), 2000);
    return () => clearInterval(t);
  }, [conn]);

  useEffect(() => () => conn?.close(), [conn]);

  const authenticate = useCallback(
    async (host: string, port: number, mode: 'login' | 'register', name: string, pass: string) => {
      setBusy(true);
      setError('');
      try {
        const res = await preauthOp(new RnTransport() as Transport, host, port,
          mode === 'login' ? 'account.login' : 'account.register', { name, pass });
        if (!res.ok || !res.b?.token) {
          setError(res.m ?? '鉴权失败');
          return;
        }
        void saveLastConn({ host, port, name });
        const c = new HorizonConn(new RnTransport() as Transport, {
          host, port, token: res.b.token,
        });
        await c.start();
        const u = await c.req('account.uuids');
        setUuids(u.ok && Array.isArray(u.b?.uuids) ? u.b.uuids : []);
        setConn(c);
        setConnected(true);
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally {
        setBusy(false);
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

  return (
    <AppContext.Provider value={{ conn, connected, uuids, setUuids, authenticate, disconnect, busy, error }}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1526" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={conn ? 'Home' : 'Login'}
          screenOptions={{ headerStyle: { backgroundColor: '#0D1526' }, headerTintColor: '#E8EEF9' }}
        >
          <Stack.Screen name="Login" component={LoginRoute} />
          <Stack.Screen name="Home" component={HomeRoute} />
          <Stack.Screen name="Team" component={TeamRoute} />
          <Stack.Screen name="Chat" component={ChatRoute} />
          <Stack.Screen name="Monitor" component={MonitorRoute} />
          <Stack.Screen name="Session" component={SessionRoute} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppContext.Provider>
  );
}
