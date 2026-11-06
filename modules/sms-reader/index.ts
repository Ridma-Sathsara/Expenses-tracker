import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type Sms = { id: string; address: string | null; body: string; date: number };

type NativeSmsReader = {
  hasPermission(): boolean;
  getInboxAsync(sinceMs: number, limit: number): Promise<Sms[]>;
};

// Only exists in the Android build; null on iOS / web.
const Native = requireOptionalNativeModule<NativeSmsReader>('SmsReader');

/** True when this device can read SMS (Android only — iOS does not allow it). */
export const isSmsSupported = Platform.OS === 'android' && Native != null;

export function hasSmsPermission(): boolean {
  return isSmsSupported && Native!.hasPermission();
}

export async function requestSmsPermission(): Promise<boolean> {
  if (!isSmsSupported) return false;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read bank SMS alerts',
    message:
      'Expense Tracker reads SMS alerts from your bank so it can log your spending automatically. ' +
      'Messages never leave your phone.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function readInbox(sinceMs: number, limit = 500): Promise<Sms[]> {
  if (!isSmsSupported) return [];
  return Native!.getInboxAsync(sinceMs, limit);
}
