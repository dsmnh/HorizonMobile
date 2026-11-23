/**
 * 设置屏（迁移适配指南 §SettingsScreen）：外观主题、本地偏好、TLS 证书信任与账号绑定身份。
 * account.uuids 返回当前账号绑定的 UUID 与可选玩家名（契约 1.6.0 §8.7）。
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, themedStyles, useTheme } from './theme';
import { Card, Chip, GhostButton, SectionLabel, Segmented, SettingsGroup, SettingsRow } from './components';
import { HorizonConn, type Res } from '../net/conn';
import { pinKey } from '../net/tls-pin';
import { loadLastConn } from './lastConn';

interface Identity {
  uuid: string;
  name?: string;
}

export interface SettingsScreenProps {
  conn?: HorizonConn;
}

export function SettingsScreen({ conn }: SettingsScreenProps): JSX.Element {
  const { mode, setMode, colors: c } = useTheme();
  const [msg, setMsg] = useState('');
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [lastConn, setLastConn] = useState<{ host: string; port: number } | null>(null);

  useEffect(() => {
    void loadLastConn().then((v) => {
      if (v) setLastConn({ host: v.host, port: v.port });
    });
  }, []);

  /** 重置后下次连接按 TOFU 重新记录指纹，用于证书轮换或换后端。 */
  const resetPin = async () => {
    if (!lastConn) {
      setMsg('暂无上次连接信息，先成功连接一次后端');
      return;
    }
    try {
      await AsyncStorage.removeItem(pinKey(lastConn.host, lastConn.port));
      setMsg(`已重置 ${lastConn.host}:${lastConn.port} 的证书信任，下次连接重新记录指纹`);
    } catch {
      setMsg('重置失败（存储不可用）');
    }
  };

  const clearConn = async () => {
    try {
      await AsyncStorage.removeItem('horizon.conn.last');
      setMsg('已清除上次连接信息');
    } catch {
      setMsg('清除失败（存储不可用）');
    }
  };

  const loadIdentities = async () => {
    if (!conn) {
      setMsg('未连接后端');
      return;
    }
    try {
      const res: Res = await conn.req('account.uuids', {});
      if (!res.ok || !Array.isArray(res.b?.uuids)) {
        setMsg(`account.uuids: ${res.m ?? '失败'}`);
        return;
      }
      setIdentities(res.b.uuids.map((u: any) => ({
        uuid: String(u.uuid),
        name: u.name == null ? undefined : String(u.name),
      })));
      setMsg(`已读取 ${res.b.uuids.length} 个绑定身份`);
    } catch (e: any) {
      setMsg(String(e.message ?? e));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>设置</Text>
      <Text style={styles.sub}>外观、证书信任与账号绑定</Text>

      <SectionLabel text="外观" />
      <Card>
        <Segmented
          options={[
            { value: 'dark', label: '深空（深色）', icon: 'moon' },
            { value: 'light', label: '日间（浅色）', icon: 'sunny' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Text style={styles.hint}>
          配色与 AEMobileApp 基线一致：深色为深空底 + 青/紫双强调色；切换后全应用即时生效。
        </Text>
      </Card>

      <SectionLabel text="TLS 证书信任" />
      <SettingsGroup footnote="重置后下次连接会重新记录服务端证书指纹；服务端使用自有证书时同样按首次连接记录。证书更换或切换到另一后端时使用。">
        <SettingsRow
          icon="shield-checkmark-outline"
          label="重置已信任证书"
          detail={lastConn ? `${lastConn.host}:${lastConn.port}` : '暂无上次连接'}
          onPress={() => void resetPin()}
        />
        <SettingsRow icon="trash-outline" label="清除上次连接信息" divider={false} tone="bad" onPress={() => void clearConn()} />
      </SettingsGroup>

      <SectionLabel text="账号绑定身份" right={<Chip label="account.uuids" tone="accent2" />} />
      <SettingsGroup>
        <SettingsRow
          icon="link-outline"
          label="查询绑定身份"
          detail={conn ? '从后端读取当前账号的 UUID 列表' : '未连接后端'}
          divider={identities.length > 0}
          disabled={!conn}
          onPress={() => void loadIdentities()}
        />
        {identities.map((id, i) => (
          <SettingsRow
            key={id.uuid}
            icon="person-outline"
            label={id.name ?? '未命名身份'}
            detail={id.uuid}
            divider={i < identities.length - 1}
          />
        ))}
      </SettingsGroup>

      {msg !== '' && (
        <View style={styles.msgBox}>
          <Text style={[styles.msg, { color: c.ok }]}>{msg}</Text>
        </View>
      )}

      <SectionLabel text="其它入口" />
      <SettingsGroup>
        <SettingsRow icon="pulse-outline" label="监控轮询 / rank.sync / admin.opSet" detail="位于监控屏" divider />
        <SettingsRow icon="key-outline" label="重设密码" detail="位于登录屏（恢复码）" divider={false} />
      </SettingsGroup>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  hint: { color: colors.textFaint, fontSize: 11, lineHeight: 17, marginTop: spacing.m },
  msgBox: { marginBottom: spacing.l },
  msg: { fontSize: 12, lineHeight: 17 },
}));
