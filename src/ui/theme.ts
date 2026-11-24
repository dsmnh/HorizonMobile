/**
 * Horizon App 主题：与 AEMobileApp 对齐的深/浅双色板。
 *
 * 风格基线取自 AEMobileApp/src/theme.tsx（深空矩阵新视野）：深色底 + 青（accent）与紫（accent2）双强调色，
 * 表面分三级（surface/surfaceAlt/surfaceHigh）用于卡片与分区，语义色带 Soft 底衬。
 *
 * 屏幕层的用法：
 *   const styles = themedStyles(() => ({ root: { backgroundColor: colors.bg } }));
 * 主题切换后由 `rev` 触发重建，屏幕无需自行监听；导航树保持挂载，以保留页面和草稿。
 * 旧屏幕仍在用 card/muted/faint/primary/primaryText/danger 这几个别名，此处保留映射，避免一次性改动全部屏幕。
 */
import { useSyncExternalStore } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

/** 与 RN 的 StyleSheet.NamedStyles 同义：把样式名映射到三种样式类型之一。 */
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export type ThemeMode = 'dark' | 'light';

export interface Palette {
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceHigh: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  /** 主强调色：青（深色）/ 深青（浅色） */
  accent: string;
  /** 次强调色：紫 */
  accent2: string;
  accentSoft: string;
  accent2Soft: string;
  ok: string;
  okSoft: string;
  warn: string;
  warnSoft: string;
  bad: string;
  badSoft: string;
  /** 旧屏幕别名：card → surface */
  card: string;
  /** 旧屏幕别名：muted → textDim */
  muted: string;
  /** 旧屏幕别名：faint → textFaint */
  faint: string;
  /** 旧屏幕别名：primary → accent */
  primary: string;
  /** 旧屏幕别名：primaryText → accent */
  primaryText: string;
  /** 旧屏幕别名：danger → bad */
  danger: string;
}

export const DARK: Palette = {
  isDark: true,
  bg: '#0B0E14',
  surface: '#141821',
  surfaceAlt: '#1B2130',
  surfaceHigh: '#232B3D',
  border: '#232A38',
  text: '#E8ECF3',
  textDim: '#9AA4B8',
  textFaint: '#8E9BAF',
  accent: '#22D3EE',
  accent2: '#A78BFA',
  accentSoft: 'rgba(34,211,238,0.14)',
  accent2Soft: 'rgba(167,139,250,0.16)',
  ok: '#34D399',
  okSoft: 'rgba(52,211,153,0.14)',
  warn: '#FBBF24',
  warnSoft: 'rgba(251,191,36,0.14)',
  bad: '#F87171',
  badSoft: 'rgba(248,113,113,0.14)',
  card: '#141821',
  muted: '#9AA4B8',
  faint: '#5C6577',
  primary: '#22D3EE',
  primaryText: '#22D3EE',
  danger: '#F87171',
};

export const LIGHT: Palette = {
  isDark: false,
  bg: '#F2F5F9',
  surface: '#FFFFFF',
  surfaceAlt: '#E9EEF5',
  surfaceHigh: '#DCE3ED',
  border: '#D5DDE8',
  text: '#111827',
  textDim: '#4A5568',
  textFaint: '#546278',
  accent: '#0E7490',
  accent2: '#6D28D9',
  accentSoft: 'rgba(14,116,144,0.10)',
  accent2Soft: 'rgba(109,40,217,0.10)',
  ok: '#047857',
  okSoft: 'rgba(4,120,87,0.10)',
  warn: '#B45309',
  warnSoft: 'rgba(180,83,9,0.10)',
  bad: '#DC2626',
  badSoft: 'rgba(220,38,38,0.10)',
  card: '#FFFFFF',
  muted: '#4A5568',
  faint: '#8592A6',
  primary: '#0E7490',
  primaryText: '#0E7490',
  danger: '#DC2626',
};

export const typography = {
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 14 },
  caption: { fontSize: 12 },
  metric: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 12, l: 16, full: 999 } as const;

let current: Palette = DARK;
let rev = 0;
const listeners = new Set<() => void>();

/**
 * 当前色板的读取代理：样式工厂在重建时读到的是最新色板，屏幕代码里照常写 colors.xxx。
 * 不直接导出对象，是为了避免模块加载时把旧色板快照进 StyleSheet。
 */
export const colors = new Proxy({} as Palette, {
  get(_t, key: string | symbol): unknown {
    return (current as unknown as Record<string | symbol, unknown>)[key];
  },
  has(_t, key: string | symbol): boolean {
    return key in (current as unknown as Record<string | symbol, unknown>);
  },
  ownKeys(): string[] {
    return Object.keys(current);
  },
  getOwnPropertyDescriptor(): PropertyDescriptor {
    return { enumerable: true, configurable: true };
  },
});

export function themeMode(): ThemeMode {
  return current.isDark ? 'dark' : 'light';
}

/** 切换色板；同一模式重复设置不触发重建。 */
export function setThemeMode(mode: ThemeMode): void {
  const next = mode === 'light' ? LIGHT : DARK;
  if (next === current) return;
  current = next;
  rev += 1;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 订阅主题：返回当前色板与切换函数；屏幕里调用一次即可获得切换后的重渲染。 */
export function useTheme(): { colors: Palette; spacing: typeof spacing; radius: typeof radius; mode: ThemeMode; setMode: (m: ThemeMode) => void } {
  useSyncExternalStore(subscribe, () => rev, () => rev);
  return { colors: current, spacing, radius, mode: current.isDark ? 'dark' : 'light', setMode: setThemeMode };
}

/**
 * 惰性样式表：色板变化后下次读取属性时重建，屏幕无需自己 memo。
 * 用法与 StyleSheet.create 一致，只是把对象包进工厂函数。
 */
export function themedStyles<T extends NamedStyles<T> | NamedStyles<any>>(factory: () => T & NamedStyles<any>): T {
  let builtRev = -1;
  let built: T | null = null;
  const ensure = (): T => {
    if (builtRev !== rev || built === null) {
      built = StyleSheet.create(factory()) as T;
      builtRev = rev;
    }
    return built;
  };
  return new Proxy({} as T, {
    get(_t, key: string | symbol): unknown {
      return (ensure() as unknown as Record<string | symbol, unknown>)[key];
    },
    ownKeys(): string[] {
      return Object.keys(ensure());
    },
    getOwnPropertyDescriptor(): PropertyDescriptor {
      return { enumerable: true, configurable: true };
    },
  });
}

/** 卡片基样式（AEMobile 的 card 同义）：surface 底 + 1px 边框 + 大圆角；随色板实时取值。 */
export function cardStyle(): { backgroundColor: string; borderRadius: number; borderWidth: number; borderColor: string } {
  return { backgroundColor: current.surface, borderRadius: radius.l, borderWidth: 1, borderColor: current.border };
}
