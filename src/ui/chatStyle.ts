import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatStyle = 'classic' | 'labels';
const key = 'horizon.chat.style';
let style: ChatStyle = 'classic';
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
let selected = false;
const listeners = new Set<() => void>();

function update(next: ChatStyle): void {
  if (style === next) return;
  style = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setChatStyle(next: ChatStyle): void {
  selected = true;
  update(next);
  writes = writes.then(() => AsyncStorage.setItem(key, next)).catch(() => undefined);
}

export function useChatStyle(): ChatStyle {
  useEffect(() => {
    loading ??= AsyncStorage.getItem(key).then((value) => {
      if (!selected && (value === 'classic' || value === 'labels')) update(value);
    }).catch(() => undefined);
  }, []);
  return useSyncExternalStore(subscribe, () => style);
}
