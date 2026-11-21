/**
 * 登录/注册屏（迁移适配指南 §SetupScreen）：后端地址 + 账号密码 + 双动作。
 * 协议面：预鉴权 account.login / account.register / account.resetPassword（src/net/preauth.ts）。
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './theme';
import { loadLastConn } from './lastConn';
import { pinKey } from '../net/tls-pin';

export interface LoginScreenProps {
  onAuthenticate: (
    host: string,
    port: number,
    mode: 'login' | 'register',
    name: string,
    pass: string,
    tls: boolean,
  ) => Promise<void>;
  /** 预鉴权重设密码；返回空字符串表示成功，否则为错误文案。 */
  onResetPassword: (
    host: string,
    port: number,
    recoverCode: string,
    newPassword: string,
    tls: boolean,
  ) => Promise<string>;
  busy: boolean;
  error: string;
}

export function LoginScreen({ onAuthenticate, onResetPassword, busy, error }: LoginScreenProps): JSX.Element {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [recoverCode, setRecoverCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  // 后端 App 平面启用 TLS 时明文连接会被断开；默认开启，本地明文联调可关闭（契约 §9.1）
  const [tls, setTls] = useState(true);
  const [pinMsg, setPinMsg] = useState('');

  // 上次成功连接的地址与账号名预填（AsyncStorage；失败保持空表单）
  useEffect(() => {
    void loadLastConn().then((last) => {
      if (last) {
        setHost(last.host);
        setPort(String(last.port));
        setName(last.name);
        setTls(last.tls !== false);
      }
      setLoaded(true);
    });
  }, []);

  const submit = (mode: 'login' | 'register') => {
    const p = parseInt(port, 10);
    if (!host || !p || !name || !pass) {
      return;
    }
    void onAuthenticate(host, p, mode, name, pass, tls);
  };

  /** 服务端换证后指纹校验会拒绝连接，此时没有会话、进不了设置页，故在登录屏就地提供重置。 */
  const resetPin = async () => {
    const p = parseInt(port, 10);
    if (!host || !p) {
      setPinMsg('需先填写后端地址与端口');
      return;
    }
    try {
      await AsyncStorage.removeItem(pinKey(host, p));
      setPinMsg(`已重置 ${host}:${p} 的证书信任，下次连接重新记录指纹`);
    } catch {
      setPinMsg('重置失败（本地存储不可用）');
    }
  };

  const submitReset = async () => {
    const p = parseInt(port, 10);
    if (!host || !p || !recoverCode.trim() || !newPass) {
      setResetMsg('需填写后端地址、恢复码与新密码');
      return;
    }
    setResetMsg('处理中…');
    const failure = await onResetPassword(host, p, recoverCode.trim(), newPass, tls);
    setResetMsg(failure || '密码已重设；该账号全部会话已注销，请用新密码登录');
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

      <Pressable style={styles.tlsRow} onPress={() => setTls((v) => !v)} disabled={busy}>
        <View style={[styles.checkbox, tls && styles.checkboxOn]}>
          {tls && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.tlsText}>启用 TLS（证书指纹首次信任）</Text>
      </Pressable>

      <Pressable style={styles.resetToggle} onPress={() => void resetPin()}>
        <Text style={styles.resetToggleText}>重置已信任证书</Text>
      </Pressable>
      {pinMsg !== '' && <Text style={styles.resetMsg}>{pinMsg}</Text>}

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.btn, styles.primary, busy && styles.disabled]}
        disabled={busy} onPress={() => submit('login')}>
        <Text style={styles.btnText}>登录</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.secondary, busy && styles.disabled]}
        disabled={busy} onPress={() => submit('register')}>
        <Text style={[styles.btnText, styles.secondaryText]}>注册新账号</Text>
      </Pressable>

      <Pressable style={styles.resetToggle} onPress={() => setResetOpen((v) => !v)}>
        <Text style={styles.resetToggleText}>{resetOpen ? '收起重设密码' : '用恢复码重设密码'}</Text>
      </Pressable>
      {resetOpen && (
        <View>
          <Text style={styles.label}>恢复码</Text>
          <TextInput
            style={styles.input}
            value={recoverCode}
            onChangeText={setRecoverCode}
            placeholder="游戏内 /dsmnhmobile recover 生成的恢复码"
            placeholderTextColor="#5A6B8C"
            autoCapitalize="none"
            editable={!busy}
          />
          <Text style={styles.label}>新密码</Text>
          <TextInput
            style={styles.input}
            value={newPass}
            onChangeText={setNewPass}
            secureTextEntry
            editable={!busy}
          />
          <Pressable style={[styles.btn, styles.secondary, busy && styles.disabled]}
            disabled={busy} onPress={() => void submitReset()}>
            <Text style={[styles.btnText, styles.secondaryText]}>重设密码</Text>
          </Pressable>
          {resetMsg !== '' && <Text style={styles.resetMsg}>{resetMsg}</Text>}
        </View>
      )}
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
  resetToggle: { alignSelf: 'flex-start', marginTop: 16, paddingVertical: 4 },
  resetToggleText: { color: colors.primaryText, fontSize: 12 },
  resetMsg: { color: colors.muted, fontSize: 12, marginTop: 8 },
  tlsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxOn: { backgroundColor: colors.primary },
  checkboxMark: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tlsText: { color: colors.muted, fontSize: 12 },
  disabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryText: { color: colors.primaryText },
});
