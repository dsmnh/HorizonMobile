/**
 * App 根入口（Expo 51 / React 18）：登录注册 → 主界面。
 * 协议面：预鉴权 account.login/register（src/net/preauth.ts）→ HorizonConn 会话 → account.uuids。
 * 旧底座入口（SQLiteProvider/导航/主题）归档于 src-app-legacy/AppEntry.legacy.tsx，
 * 随逐屏迁移增量逐步接线（迁移适配指南 §逐屏适配清单）。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text } from 'react-native';
import { HorizonConn, type Res, type Transport } from './src/net/conn';
import { RnTransport } from './src/net/transport-rn';
import { preauthOp } from './src/net/preauth';
import { LoginScreen } from './src/ui/LoginScreen';
import { HomeScreen } from './src/ui/HomeScreen';

interface SessionInfo {
  host: string;
  port: number;
  token: string;
}

export default function App(): JSX.Element {
  const [session, setSession] = useState<SessionInfo | null>(null);
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
        const info: SessionInfo = { host, port, token: res.b.token };
        const c = new HorizonConn(new RnTransport() as Transport, {
          host, port, token: info.token,
        });
        await c.start();
        const u: Res = await c.req('account.uuids');
        setUuids(u.ok && Array.isArray(u.b?.uuids) ? u.b.uuids : []);
        setSession(info);
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
    setSession(null);
    setConnected(false);
    setUuids([]);
  }, [conn]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1526" />
      <ScrollView contentContainerStyle={styles.body}>
        {session == null ? (
          <LoginScreen onAuthenticate={authenticate} busy={busy} error={error} />
        ) : (
          <HomeScreen
            host={session.host}
            port={session.port}
            connected={connected}
            uuids={uuids}
            conn={conn}
            onDisconnect={disconnect}
          />
        )}
      </ScrollView>
      <Text style={styles.footerText}>Horizon · 协议 1.5.x · 会话经 HMAC 鉴权</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1526' },
  body: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  footerText: {
    color: '#5A6B8C',
    fontSize: 11,
    textAlign: 'center',
    paddingBottom: 8,
  },
});
