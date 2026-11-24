import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsGroup, SettingsRow } from './components';
import { useTheme } from './theme';
import { pinKey } from '../net/tls-pin';
import { loadLastConn } from './lastConn';

export function SettingsScreen(): JSX.Element {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [endpoint, setEndpoint] = useState<{ host: string; port: number } | null>(null);

  useEffect(() => {
    void loadLastConn().then(setEndpoint);
  }, []);

  const confirmReset = () => {
    if (!endpoint) return;
    const { host, port } = endpoint;
    Alert.alert('重置已信任证书', '下次连接将重新记录服务端证书指纹。', [
      { text: '取消', style: 'cancel' },
      { text: '重置', style: 'destructive', onPress: async () => {
        try {
          await AsyncStorage.removeItem(pinKey(host, port));
          setMessage('已重置证书信任');
        } catch {
          setMessage('重置失败，本地存储不可用');
        }
      } },
    ]);
  };

  const clearEndpoint = async () => {
    try {
      await AsyncStorage.removeItem('horizon.conn.last');
      setEndpoint(null);
      setMessage('已清除上次连接信息');
    } catch {
      setMessage('清除失败，本地存储不可用');
    }
  };

  return <>
    <SettingsGroup title="证书信任" footnote="服务端证书轮换后，可在这里重置已记录的指纹。登录页也提供重置入口。">
      <SettingsRow icon="shield-checkmark-outline" label="重置已信任证书"
        detail={endpoint ? `${endpoint.host}:${endpoint.port}` : '暂无上次连接'} disabled={!endpoint} onPress={confirmReset} divider={false} />
    </SettingsGroup>
    <SettingsGroup title="本地连接记录">
      <SettingsRow icon="trash-outline" label="清除上次连接信息" divider={false} tone="bad"
        disabled={!endpoint} onPress={() => void clearEndpoint()} />
    </SettingsGroup>
    {message !== '' && <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>{message}</Text>}
  </>;
}
