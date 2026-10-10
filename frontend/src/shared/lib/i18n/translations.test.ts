import { describe, it, expect } from 'vitest';
import { ru } from './translations/ru.ts';
import { en } from './translations/en.ts';
import { uz } from './translations/uz.ts';

describe('i18n translations key parity', () => {
  it('en has all keys from ru', () => {
    const ruKeys = Object.keys(ru);
    const enKeys = new Set(Object.keys(en));
    const missingInEn = ruKeys.filter((k) => !enKeys.has(k));
    expect(missingInEn).toEqual([]);
  });

  it('uz has all keys from ru', () => {
    const ruKeys = Object.keys(ru);
    const uzKeys = new Set(Object.keys(uz));
    const missingInUz = ruKeys.filter((k) => !uzKeys.has(k));
    expect(missingInUz).toEqual([]);
  });

  it('ru has all keys from en', () => {
    const enKeys = Object.keys(en);
    const ruKeys = new Set(Object.keys(ru));
    const missingInRu = enKeys.filter((k) => !ruKeys.has(k));
    expect(missingInRu).toEqual([]);
  });
});
