/**
 * 主界面（迁移适配指南 §首屏占位）：连接状态 + 绑定 UUID 列表 + 断开。
 * 队伍/聊天/ME 各屏随逐屏迁移增量接入（guide §逐屏适配清单）。
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type HorizonConn } from '../net/conn';
import { TeamScreen } from './TeamScreen';
import { ChatScreen } from './ChatScreen';
import { TeamOpsScreen } from './TeamOpsScreen';
import { BindScreen } from './BindScreen';
import { MonitorScreen } from './MonitorScreen';

export interface HomeScreenProps {
  host: string;
  port: number;
  connected: boolean;
  uuids: string[];
  conn: HorizonConn | null;
  onDisconnect: () => void;
  onUuidsChanged: (uuids: string[]) => void;
}

export function HomeScreen({ host, port, connected, uuids, conn, onDisconnect, onUuidsChanged }: HomeScreenProps): JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.brand}>Horizon</Text>
      <View style={styles.statusRow}>
        <View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]} />
        <Text style={styles.statusText}>
          {connected ? `已连接 ${host}:${port}` : '连接中断，自动重连中…'}
        </Text>
      </View>

      <Text style={styles.label}>绑定 UUID</Text>
      {uuids.length === 0 ? (
        conn != null && (
          <BindScreen
            conn={conn}
            onBound={(list) => {
              if (list.length > 0) onUuidsChanged(list);
            }}
          />
        )
      ) : (
        <View>
          {uuids.map((u) => (
            <View key={u} style={styles.uuidRow}>
              <Text style={styles.uuidText}>{u}</Text>
            </View>
          ))}
          {conn != null && (
            <>
              <TeamScreen conn={conn} uuid={uuids[0]} />
              <TeamOpsScreen conn={conn} uuid={uuids[0]} onChanged={() => undefined} />
              <ChatScreen conn={conn} uuid={uuids[0]} />
            </>
          )}
        </View>
      )}

      {conn != null && <MonitorScreen conn={conn} />}

      <Pressable style={styles.btn} onPress={onDisconnect}>
        <Text style={styles.btnText}>断开连接</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  brand: { color: '#E8EEF9', fontSize: 30, fontWeight: '700', letterSpacing: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 20 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  dotOn: { backgroundColor: '#4CC38A' },
  dotOff: { backgroundColor: '#E4A24C' },
  statusText: { color: '#8FA3C7', fontSize: 13 },
  label: { color: '#8FA3C7', fontSize: 12, marginTop: 14, marginBottom: 6 },
  empty: { color: '#5A6B8C', fontSize: 13, lineHeight: 20 },
  uuidRow: {
    backgroundColor: '#16203A',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  uuidText: { color: '#E8EEF9', fontSize: 13 },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 26,
    borderWidth: 1,
    borderColor: '#E46A6A',
  },
  btnText: { color: '#E46A6A', fontSize: 15, fontWeight: '600' },
});
