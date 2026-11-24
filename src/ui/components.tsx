/**
 * 共享 UI 组件（对齐 AEMobileApp/src/components.tsx 的视觉基线）。
 *
 * 约定：组件内部统一通过 useTheme() 取当前色板，屏幕只负责布局与数据；
 * 需要随主题重建的静态样式用 themedStyles(() => ({...})) 包一层。
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography, useTheme } from './theme';

export type Tone = 'neutral' | 'ok' | 'bad' | 'warn' | 'accent' | 'accent2';

/** 状态点：带同色发光外圈，用来表达连接/在线状态。 */
export function StatusDot({ ok, size = 8 }: { ok: boolean; size?: number }): JSX.Element {
  const { colors } = useTheme();
  const color = ok ? colors.ok : colors.warn;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: size,
        shadowOffset: { width: 0, height: 0 },
        elevation: 3,
      }}
    />
  );
}

export function PageHeader({ title, connected, onRefresh, refreshing }: {
  title: string; connected: boolean; onRefresh?: () => void; refreshing?: boolean;
}): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m, marginBottom: spacing.m }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? colors.ok : colors.bad }} />
          <Text style={[typography.caption, { color: colors.textDim }]}>{connected ? '后端已连接' : '连接中断 · 正在重连'}</Text>
        </View>
      </View>
      {onRefresh && <Pressable accessibilityRole="button" accessibilityLabel="刷新" onPress={onRefresh}
        disabled={refreshing || !connected} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
          borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth, backgroundColor: colors.surface, borderColor: colors.border }}>
        {refreshing ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="refresh" size={21} color={colors.textDim} />}
      </Pressable>}
    </View>
  );
}

export function StateNotice({ children, tone = 'warn', loading = false }: {
  children: string; tone?: 'warn' | 'bad' | 'neutral'; loading?: boolean;
}): JSX.Element {
  const { colors } = useTheme();
  const color = tone === 'bad' ? colors.bad : tone === 'warn' ? colors.warn : colors.textDim;
  const backgroundColor = tone === 'bad' ? colors.badSoft : tone === 'warn' ? colors.warnSoft : colors.surfaceAlt;
  return <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: spacing.s, alignItems: 'center',
    padding: spacing.m, marginVertical: spacing.xs, borderRadius: radius.m, backgroundColor }}>
    {loading && <ActivityIndicator color={color} size="small" />}
    <Text style={[typography.caption, { color, flex: 1 }]}>{children}</Text>
  </View>;
}

/** 小标签：软底 + 同色文字。 */
export function Chip({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
}): JSX.Element {
  const { colors } = useTheme();
  const fg =
    tone === 'ok' ? colors.ok : tone === 'bad' ? colors.bad : tone === 'warn' ? colors.warn : tone === 'accent' ? colors.accent : tone === 'accent2' ? colors.accent2 : colors.textDim;
  const bg =
    tone === 'ok' ? colors.okSoft : tone === 'bad' ? colors.badSoft : tone === 'warn' ? colors.warnSoft : tone === 'accent' ? colors.accentSoft : tone === 'accent2' ? colors.accent2Soft : colors.surfaceAlt;
  return (
    <View style={[chipStyles.wrap, { backgroundColor: bg, borderColor: fg + '33' }]}>
      {icon ? <Ionicons name={icon} size={11} color={fg} /> : null}
      <Text style={[chipStyles.text, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** 卡片容器：surface 底 + 细边框。 */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[cardStyles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

/** 主按钮：实心强调色，可按 tone 切危险色；loading 时显示转圈。 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = 'accent',
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'bad';
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}): JSX.Element {
  const { colors } = useTheme();
  const bg = tone === 'accent' ? colors.accent : colors.bad;
  const fg = colors.isDark ? colors.bg : '#FFFFFF';
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        btnStyles.primary,
        { backgroundColor: bg, opacity: disabled && !loading ? 0.4 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
          <Text style={[btnStyles.primaryText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** 次级按钮：描边。 */
export function GhostButton({
  label,
  onPress,
  disabled,
  icon,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'accent' | 'bad' | 'neutral';
}): JSX.Element {
  const { colors } = useTheme();
  const fg = tone === 'bad' ? colors.bad : tone === 'neutral' ? colors.textDim : colors.accent;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        btnStyles.ghost,
        { borderColor: fg + '66', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={fg} /> : null}
      <Text style={[btnStyles.ghostText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** 输入框：深色填充 + 聚焦边框由外层控制。 */
export function StyledInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secure,
  right,
  multiline,
  editable = true,
  autoCorrect = false,
  autoCapitalize = 'none',
  onSubmitEditing,
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  right?: React.ReactNode;
  multiline?: boolean;
  editable?: boolean;
  autoCorrect?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
}): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[inputStyles.wrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
      <TextInput
        style={[inputStyles.input, { color: colors.text }, multiline && inputStyles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        multiline={multiline}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
      />
      {right}
    </View>
  );
}

/** 字段标签。 */
export function FieldLabel({ text }: { text: string }): JSX.Element {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: spacing.s, marginTop: spacing.m }}>{text}</Text>;
}

/** 分区标题（卡片外）。 */
export function SectionLabel({ text, right }: { text: string; right?: React.ReactNode }): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={sectionStyles.row}>
      <Text style={[sectionStyles.text, { color: colors.textFaint }]}>{text}</Text>
      {right}
    </View>
  );
}

/** 空态：图标 + 标题 + 说明。 */
export function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={emptyStyles.wrap}>
      <Ionicons name={icon} size={28} color={colors.textFaint} />
      <Text style={[emptyStyles.title, { color: colors.textDim }]}>{title}</Text>
      {subtitle ? <Text style={[emptyStyles.sub, { color: colors.textFaint }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** 细进度条。 */
export function ProgressBar({ ratio, tone = 'accent', height = 6 }: { ratio: number; tone?: Tone; height?: number }): JSX.Element {
  const { colors } = useTheme();
  const fg = tone === 'ok' ? colors.ok : tone === 'bad' ? colors.bad : tone === 'warn' ? colors.warn : tone === 'accent2' ? colors.accent2 : colors.accent;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' }}>
      <View style={{ width: `${clamped * 100}%`, height, borderRadius: height / 2, backgroundColor: fg }} />
    </View>
  );
}

/** 设置分组：标题 + 卡片 + 脚注。 */
export function SettingsGroup({ title, footnote, children }: { title?: string; footnote?: string; children: React.ReactNode }): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.l }}>
      {title ? <Text style={[groupStyles.title, { color: colors.textFaint }]}>{title}</Text> : null}
      <Card style={{ overflow: 'hidden', padding: 0 }}>{children}</Card>
      {footnote ? <Text style={[groupStyles.footnote, { color: colors.textFaint }]}>{footnote}</Text> : null}
    </View>
  );
}

/** 设置行：图标 + 标题/副标题 + 右侧值；有 onPress 时整行可点并显示箭头。 */
export function SettingsRow({
  icon,
  label,
  detail,
  value,
  onPress,
  right,
  tone = 'default',
  divider = true,
  disabled,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string | null;
  value?: string | null;
  onPress?: () => void;
  right?: React.ReactNode;
  tone?: 'default' | 'bad';
  divider?: boolean;
  disabled?: boolean;
}): JSX.Element {
  const { colors } = useTheme();
  const body = (
    <View
      style={[
        groupStyles.row,
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon ? (
        <View style={[groupStyles.iconBox, { backgroundColor: tone === 'bad' ? colors.badSoft : colors.accentSoft }]}>
          <Ionicons name={icon} size={16} color={tone === 'bad' ? colors.bad : colors.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[groupStyles.label, { color: tone === 'bad' ? colors.bad : colors.text }]} numberOfLines={1}>{label}</Text>
        {detail ? <Text style={[groupStyles.detail, { color: colors.textFaint }]} numberOfLines={2}>{detail}</Text> : null}
      </View>
      {value ? <Text style={[groupStyles.value, { color: colors.textDim }]} numberOfLines={1}>{value}</Text> : null}
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}>
      {body}
    </Pressable>
  );
}

/** 分段选择器（深色/浅色、监控范围等二选一场景）。 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (v: T) => void;
}): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[segStyles.wrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[segStyles.item, on && { backgroundColor: colors.surfaceHigh }]}
          >
            {o.icon ? <Ionicons name={o.icon} size={14} color={on ? colors.accent : colors.textDim} /> : null}
            <Text style={[segStyles.text, { color: on ? colors.text : colors.textDim }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600' },
});

const cardStyles = StyleSheet.create({
  wrap: { borderRadius: radius.l, borderWidth: 1, padding: spacing.l },
});

const btnStyles = StyleSheet.create({
  primary: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: spacing.l,
    borderRadius: radius.m,
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
  ghost: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.m,
    borderRadius: radius.m,
    borderWidth: 1,
  },
  ghostText: { fontSize: 13, fontWeight: '600' },
});

const inputStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.m,
    borderWidth: 1,
    paddingHorizontal: spacing.m,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 15 },
  multiline: { minHeight: 60, textAlignVertical: 'top', paddingTop: 10 },
});

const sectionStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.l, marginBottom: spacing.s },
  text: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
});

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.s },
  title: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});

const groupStyles = StyleSheet.create({
  title: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: spacing.s, marginTop: spacing.s },
  footnote: { fontSize: 11, lineHeight: 17, marginTop: spacing.s },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: 10, paddingHorizontal: spacing.l },
  iconBox: { width: 30, height: 30, borderRadius: radius.s, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '500' },
  detail: { fontSize: 11, marginTop: 2 },
  value: { fontSize: 12, maxWidth: 140 },
});

const segStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 3, borderRadius: radius.m, borderWidth: 1, gap: 3 },
  item: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: radius.s },
  text: { fontSize: 12, fontWeight: '600' },
});
