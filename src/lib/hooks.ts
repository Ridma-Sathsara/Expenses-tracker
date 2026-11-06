import { useCallback, useEffect, useState } from 'react';
import { getLocales } from 'expo-localization';
import { getSetting, onDataChange, setSetting } from './db';

/** A counter that bumps whenever expenses or settings change, to trigger reloads. */
export function useDataVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => onDataChange(() => setV((x) => x + 1)), []);
  return v;
}

/** Runs `load` on mount and whenever data changes. */
export function useLoad<T>(load: () => Promise<T>, initial: T, deps: unknown[] = []): [T, () => void] {
  const version = useDataVersion();
  const [data, setData] = useState<T>(initial);
  const reload = useCallback(() => {
    load().then(setData).catch((e) => console.warn(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(reload, [reload, version]);
  return [data, reload];
}

export function defaultCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? 'USD';
  } catch {
    return 'USD';
  }
}

export type Settings = { currency: string; budget: number; smsAutoImport: boolean };

export function useSettings(): Settings & { update: (k: keyof Settings, v: string) => Promise<void> } {
  const [s] = useLoad<Settings>(
    async () => ({
      currency: (await getSetting('currency')) ?? defaultCurrency(),
      budget: Number((await getSetting('budget')) ?? 0) || 0,
      smsAutoImport: (await getSetting('smsAutoImport')) === '1',
    }),
    { currency: '', budget: 0, smsAutoImport: false },
  );
  return { ...s, update: (k, v) => setSetting(k, v) };
}
