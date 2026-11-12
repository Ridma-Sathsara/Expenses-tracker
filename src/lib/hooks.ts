import { useCallback, useEffect, useState } from 'react';
import { getSetting, getTrackingStart, onDataChange, setSetting } from './db';

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

/** Sri Lankan Rupees by default; can be changed in Settings. */
export function defaultCurrency(): string {
  return 'Rs';
}

export type Settings = { currency: string; budget: number; smsAutoImport: boolean; trackingStart: number };

export function useSettings(): Settings & { update: (k: 'currency' | 'budget' | 'smsAutoImport' | 'currencyUserSet', v: string) => Promise<void> } {
  const [s] = useLoad<Settings>(
    async () => ({
      currency: (await getSetting('currency')) ?? defaultCurrency(),
      budget: Number((await getSetting('budget')) ?? 0) || 0,
      smsAutoImport: (await getSetting('smsAutoImport')) === '1',
      trackingStart: await getTrackingStart(),
    }),
    { currency: '', budget: 0, smsAutoImport: false, trackingStart: 0 },
  );
  return { ...s, update: (k, v) => setSetting(k, v) };
}
