/**
 * 登录/注册屏（迁移适配指南 §SetupScreen）：后端地址 + 账号密码 + 双动作。
 * 协议面：预鉴权 account.login / account.register / account.resetPassword（src/net/preauth.ts）。
 * 视觉对齐 AEMobileApp：品牌头 + 卡片式表单 + 主/次按钮。
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, themedStyles, useTheme } from './theme';
import { Card, Chip, FieldLabel, GhostButton, PrimaryButton, StyledInput } from './components';
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
  const { colors: c } = useTheme();
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
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={[styles.logo, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="planet" size={26} color={c.accent} />
        </View>
        <View>
          <Text style={styles.brand}>Horizon</Text>
          <Text style={styles.subtitle}>深空矩阵新视野 · 移动端</Text>
        </View>
      </View>

      <Card style={{ marginTop: spacing.l }}>
        <FieldLabel text="后端地址" />
        <View style={styles.row}>
          <StyledInput value={host} onChangeText={setHost} placeholder="192.168.x.x" editable={!busy} style={{ flex: 1 }} />
          <StyledInput value={port} onChangeText={setPort} keyboardType="number-pad" editable={!busy} style={{ width: 92 }} />
        </View>

        <FieldLabel text="账号" />
        <StyledInput value={name} onChangeText={setName} editable={!busy} placeholder="账号名" />

        <FieldLabel text="密码" />
        <StyledInput value={pass} onChangeText={setPass} secure editable={!busy} placeholder="密码" />

        <Pressable style={styles.tlsRow} onPress={() => setTls((v) => !v)} disabled={busy}>
          <View style={[styles.checkbox, { borderColor: tls ? c.accent : c.border, backgroundColor: tls ? c.accent : 'transparent' }]}>
            {tls && <Ionicons name="checkmark" size={13} color={c.isDark ? c.bg : '#FFFFFF'} />}
          </View>
          <Text style={styles.tlsText}>启用 TLS（证书指纹首次信任）</Text>
          <Chip label={tls ? '安全' : '明文'} tone={tls ? 'ok' : 'warn'} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => void resetPin()}>
          <Ionicons name="refresh" size={12} color={c.accent} />
          <Text style={styles.linkText}>重置已信任证书</Text>
        </Pressable>
        {pinMsg !== '' && <Text style={styles.note}>{pinMsg}</Text>}

        {error !== '' && (
          <View style={[styles.errorBox, { backgroundColor: c.badSoft, borderColor: c.bad + '55' }]}>
            <Ionicons name="alert-circle" size={14} color={c.bad} />
            <Text style={[styles.errorText, { color: c.bad }]}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: spacing.l, gap: spacing.s }}>
          <PrimaryButton label="登录" icon="log-in-outline" onPress={() => submit('login')} loading={busy} />
          <GhostButton label="注册新账号" icon="person-add-outline" onPress={() => submit('register')} disabled={busy} />
        </View>
      </Card>

      <Pressable style={styles.linkRow} onPress={() => setResetOpen((v) => !v)}>
        <Ionicons name={resetOpen ? 'chevron-up' : 'key-outline'} size={12} color={c.accent} />
        <Text style={styles.linkText}>{resetOpen ? '收起重设密码' : '用恢复码重设密码'}</Text>
      </Pressable>
      {resetOpen && (
        <Card style={{ marginTop: spacing.s }}>
          <FieldLabel text="恢复码" />
          <StyledInput
            value={recoverCode}
            onChangeText={setRecoverCode}
            placeholder="游戏内 /dsmnhmobile recover 生成的恢复码"
            editable={!busy}
          />
          <FieldLabel text="新密码" />
          <StyledInput value={newPass} onChangeText={setNewPass} secure editable={!busy} />
          <View style={{ marginTop: spacing.m }}>
            <GhostButton label="重设密码" icon="key-outline" onPress={() => void submitReset()} disabled={busy} />
          </View>
          {resetMsg !== '' && <Text style={styles.note}>{resetMsg}</Text>}
        </Card>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { width: '100%', maxWidth: 460, alignSelf: 'center', marginTop: spacing.xl },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  logo: { width: 48, height: 48, borderRadius: radius.l, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: 1.5 },
  subtitle: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.s },
  tlsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.l },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.s / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlsText: { color: colors.textDim, fontSize: 12, flex: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.m, paddingVertical: 4 },
  linkText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  note: { color: colors.textDim, fontSize: 11, marginTop: spacing.s, lineHeight: 16 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.m,
    padding: spacing.m,
    borderRadius: radius.s,
    borderWidth: 1,
  },
  errorText: { fontSize: 12, flex: 1, lineHeight: 17 },
}));
