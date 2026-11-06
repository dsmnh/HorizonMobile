/**
 * 登录/注册屏（迁移适配指南 §SetupScreen）：后端地址 + 账号密码 + 双动作。
 * 协议面：预鉴权 account.login / account.register（src/net/preauth.ts）。
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../ui/theme';
import { loadLastConn } from './lastConn';

export interface LoginScreenProps {
  onAuthenticate: (
    host: string,
    port: number,
    mode: 'login' | 'register',
    name: string,
    pass: string,
  ) => Promise<void>;
  busy: boolean;
  error: string;
}

export function LoginScreen({ onAuthenticate, busy, error }: LoginScreenProps): JSX.Element {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [loaded, setLoaded] = useState(false);

  // 上次成功连接的地址与账号名预填（AsyncStorage；失败保持空表单）
  useEffect(() => {
    void loadLastConn().then((last) => {
      if (last) {
        setHost(last.host);
        setPort(String(last.port));
        setName(last.name);
      }
      setLoaded(true);
    });
  }, []);

  const submit = (mode: 'login' | 'register') => {
    const p = parseInt(port, 10);
    if (!host || !p || !name || !pass) {
      return;
    }
    void onAuthenticate(host, p, mode, name, pass);
  };

  if (!loaded) {
    return <View style={styles.card} />;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.brand}>Horizon</Text>
      <Text style={styles.subtitle}>深空矩阵新视野 · 移动端</Text>

      <Text style={styles.label}>后端地址</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.hostInput]}
          value={host}
          onChangeText={setHost}
          placeholder="192.168.x.x"
          placeholderTextColor="#5A6B8C"
          autoCapitalize="none"
          editable={!busy}
        />
        <TextInput
          style={styles.portInput}
          value={port}
          onChangeText={setPort}
          keyboardType="number-pad"
          editable={!busy}
        />
      </View>

      <Text style={styles.label}>账号</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
        editable={!busy}
      />

      <Text style={styles.label}>密码</Text>
      <TextInput
        style={styles.input}
        value={pass}
        onChangeText={setPass}
        secureTextEntry
        editable={!busy}
      />

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.btn, styles.primary, busy && styles.disabled]}
        disabled={busy} onPress={() => submit('login')}>
        <Text style={styles.btnText}>登录</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.secondary, busy && styles.disabled]}
        disabled={busy} onPress={() => submit('register')}>
        <Text style={[styles.btnText, styles.secondaryText]}>注册新账号</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  brand: { color: colors.text, fontSize: 34, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: colors.faint, fontSize: 13, marginBottom: 28 },
  label: { color: colors.muted, fontSize: 12, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  hostInput: {},
  portInput: {
    width: 90,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 12 },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryText: { color: colors.primaryText },
});
