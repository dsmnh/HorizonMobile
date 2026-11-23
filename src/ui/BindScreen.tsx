/**
 * 绑定管理屏（迁移适配指南 §阶段 1 流程）：输入游戏内 /dsmnhmobile bind 出的绑定码，
 * 调 account.bindUUID 绑定游戏 UUID；成功后回调上层刷新 uuid 列表。
 * 绑定码 10 分钟有效且一次性、新码注销旧码（企划书 03）。
 * 视觉对齐 AEMobileApp：品牌提示 + 表单卡。
 */
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from './theme';
import { Card, Chip, FieldLabel, PrimaryButton, SectionLabel, StyledInput } from './components';
import { HorizonConn, type Res } from '../net/conn';
import { normalizeUuids } from '../net/identity';

export interface BindScreenProps {
  conn: HorizonConn;
  onBound: (uuids: string[]) => void;
}

export function BindScreen({ conn, onBound }: BindScreenProps): JSX.Element {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const submit = async () => {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res: Res = await conn.req('account.bindUUID', { code: c });
      if (res.ok) {
        // bindUUID 只回单个 uuid，列表以 account.uuids 为准（1.6.0 起条目带玩家名）
        const list = await conn.req('account.uuids', {});
        const uuids = list.ok ? normalizeUuids(list.b?.uuids) : normalizeUuids([res.b?.uuid]);
        setOk('绑定成功');
        setCode('');
        onBound(uuids);
      } else {
        setError(res.m ?? '绑定失败');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.title}>绑定游戏身份</Text>
          <Text style={styles.sub}>把游戏内 UUID 关联到当前账号</Text>
        </View>
        <Chip label="一次性" tone="warn" />
      </View>

      <View style={[styles.hintBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent + '44' }]}>
        <Text style={[styles.hintText, { color: colors.accent }]}>
          进游戏执行 /dsmnhmobile bind 获取绑定码（10 分钟内有效，仅一次；新码会注销旧码）。
        </Text>
      </View>

      <SectionLabel text="绑定码" right={<Chip label="account.bindUUID" tone="accent2" />} />
      <Card>
        <FieldLabel text="游戏内绑定码" />
        <StyledInput value={code} onChangeText={setCode} placeholder="例如 KKBQJ3C6"
          autoCapitalize="characters" editable={!busy} onSubmitEditing={() => void submit()} />
        <View style={{ marginTop: spacing.l }}>
          <PrimaryButton label="绑定" icon="link-outline" loading={busy}
            disabled={busy || code.trim() === ''} onPress={() => void submit()} />
        </View>
        {error !== '' && (
          <View style={[styles.msgBox, { backgroundColor: colors.badSoft, borderColor: colors.bad + '55' }]}>
            <Text style={[styles.msgText, { color: colors.bad }]}>{error}</Text>
          </View>
        )}
        {ok !== '' && (
          <View style={[styles.msgBox, { backgroundColor: colors.okSoft, borderColor: colors.ok + '55' }]}>
            <Text style={[styles.msgText, { color: colors.ok }]}>{ok}</Text>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  wrap: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  hintBox: { marginTop: spacing.m, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  hintText: { fontSize: 12, lineHeight: 18 },
  msgBox: { marginTop: spacing.m, padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  msgText: { fontSize: 12, lineHeight: 17 },
}));
