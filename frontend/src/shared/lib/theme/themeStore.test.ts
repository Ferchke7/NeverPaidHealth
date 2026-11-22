import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from './themeStore.ts';

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

const classSet = new Set<string>();
const attrMap: Record<string, string> = {};

(globalThis as any).localStorage = storageMock;
(globalThis as any).document = {
  documentElement: {
    dataset: {} as Record<string, string>,
    classList: {
      add: (cls: string) => classSet.add(cls),
      remove: (cls: string) => classSet.delete(cls),
      toggle: (cls: string, force?: boolean) => {
        if (force) classSet.add(cls);
        else classSet.delete(cls);
      },
      contains: (cls: string) => classSet.has(cls),
    },
    style: { colorScheme: '' },
    setAttribute: (k: string, v: string) => {
      attrMap[k] = v;
    },
  },
  querySelector: () => ({ setAttribute: () => {} }),
};

describe('useThemeStore', () => {
  beforeEach(() => {
    storageMock.clear();
    classSet.clear();
    useThemeStore.getState().setTheme('light');
  });

  it('switches between light and dark themes and updates storage and html root', () => {
    expect(useThemeStore.getState().theme).toBe('light');
    expect(classSet.has('dark')).toBe(false);

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(storageMock.getItem('duda_theme_v1')).toBe('dark');
    expect(attrMap['data-theme']).toBe('dark');
    expect(classSet.has('dark')).toBe(true);

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(storageMock.getItem('duda_theme_v1')).toBe('light');
    expect(attrMap['data-theme']).toBe('light');
    expect(classSet.has('dark')).toBe(false);
  });
});
