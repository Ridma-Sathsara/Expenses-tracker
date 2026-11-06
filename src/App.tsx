import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useIncomingShare } from 'expo-sharing';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { autoImportSms } from './lib/sms';
import { getSetting, setSetting } from './lib/db';
import { defaultCurrency } from './lib/hooks';
import { ChatScreen } from './screens/ChatScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SmsScreen } from './screens/SmsScreen';
import { useTheme } from './theme';

type Tab = 'home' | 'chat' | 'sms' | 'settings';

const TABS: { id: Tab; label: string; icon: string; title: string }[] = [
  { id: 'home', label: 'Home', icon: '🏠', title: 'Expenses' },
  { id: 'chat', label: 'Chat', icon: '💬', title: 'Chat' },
  { id: 'sms', label: 'SMS', icon: '✉️', title: 'Bank SMS' },
  { id: 'settings', label: 'Settings', icon: '⚙️', title: 'Settings' },
];

function Root() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('home');
  const [incoming, setIncoming] = useState<string | null>(null);
  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();

  // Default to Rs. Version 1.0.1 guessed the currency from the phone region (often USD);
  // switch that to Rs unless the user picked a currency themselves in Settings.
  useEffect(() => {
    (async () => {
      const [c, userSet] = await Promise.all([getSetting('currency'), getSetting('currencyUserSet')]);
      if (!c || (userSet !== '1' && c !== defaultCurrency())) await setSetting('currency', defaultCurrency());
    })();
  }, []);

  // Text shared from another app (WhatsApp, Messages, …) goes to the chat.
  useEffect(() => {
    const text = sharedPayloads
      .filter((p) => p.shareType === 'text' || p.shareType === 'url')
      .map((p) => p.value)
      .filter(Boolean)
      .join('\n');
    if (text) {
      setIncoming(text);
      setTab('chat');
      clearSharedPayloads();
    }
  }, [sharedPayloads, clearSharedPayloads]);

  // Auto-import bank SMS on launch and every time the app comes back to the foreground.
  useEffect(() => {
    const run = () => autoImportSms().catch((e) => console.warn('SMS auto-import failed', e));
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, []);

  const current = TABS.find((x) => x.id === tab)!;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <StatusBar style="auto" />
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Text style={[styles.headerText, { color: t.text }]}>{current.title}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'chat' && <ChatScreen incoming={incoming} onIncomingHandled={() => setIncoming(null)} />}
        {tab === 'sms' && <SmsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>
      <View style={[styles.tabBar, { backgroundColor: t.card, borderTopColor: t.border }]}>
        {TABS.map((x) => {
          const active = x.id === tab;
          return (
            <Pressable key={x.id} onPress={() => setTab(x.id)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Text style={{ fontSize: 20, opacity: active ? 1 : 0.5 }}>{x.icon}</Text>
              <Text style={{ fontSize: 11, color: active ? t.primary : t.muted, fontWeight: active ? '700' : '500' }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { fontSize: 22, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
});
