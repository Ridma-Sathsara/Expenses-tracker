import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getCategory } from '../lib/categories';
import { deleteAllExpenses, listAllExpenses, setTrackingStart } from '../lib/db';
import { formatDate, formatTime, fromIsoDate, startOfDay, toIsoDate } from '../lib/format';
import { useSettings } from '../lib/hooks';
import { useTheme } from '../theme';

function csvCell(v: string | number | null): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SettingsScreen() {
  const t = useTheme();
  const settings = useSettings();
  const [currency, setCurrency] = useState('');
  const [budget, setBudget] = useState('');
  const [startText, setStartText] = useState('');

  useEffect(() => setCurrency(settings.currency), [settings.currency]);
  useEffect(() => setBudget(settings.budget ? String(settings.budget) : ''), [settings.budget]);
  useEffect(() => setStartText(settings.trackingStart ? toIsoDate(settings.trackingStart) : ''), [settings.trackingStart]);

  const save = async () => {
    const raw = currency.trim().slice(0, 6);
    // Keep "Rs" as typed; upper-case codes like lkr -> LKR.
    const cur = /^rs\.?$/i.test(raw) ? 'Rs' : raw.toUpperCase();
    const b = budget.trim() ? Number(budget.replace(/,/g, '')) : 0;
    if (!cur) return Alert.alert('Currency is required', 'For example Rs, LKR or USD.');
    if (!Number.isFinite(b) || b < 0) return Alert.alert('Invalid budget', 'Enter a number, or leave it empty.');
    const startMidday = fromIsoDate(startText);
    if (startMidday == null) return Alert.alert('Invalid start date', 'Use the format YYYY-MM-DD, e.g. 2026-11-10.');
    const start = startOfDay(startMidday);
    if (start > Date.now()) return Alert.alert('Invalid start date', 'The start date cannot be in the future.');
    if (start !== settings.trackingStart) await setTrackingStart(start);
    await settings.update('currency', cur);
    await settings.update('currencyUserSet', '1');
    await settings.update('budget', String(b));
    Alert.alert('Saved');
  };

  const exportCsv = async () => {
    const all = await listAllExpenses();
    if (all.length === 0) return Alert.alert('Nothing to export yet');
    const header = 'date,time,type,amount,signed_amount,currency,category,note,merchant,source';
    const rows = all.map((e) =>
      [toIsoDate(e.date), formatTime(e.date), e.type === 'income' ? 'cash in' : 'cash out', e.amount, e.type === 'income' ? e.amount : -e.amount, settings.currency, getCategory(e.category).label, e.note, e.merchant, e.source]
        .map(csvCell)
        .join(','),
    );
    const file = new File(Paths.cache, `expenses-${toIsoDate(Date.now())}.csv`);
    file.create({ overwrite: true });
    await file.write([header, ...rows].join('\n'));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export expenses' });
    } else {
      Alert.alert('Saved', file.uri);
    }
  };

  const wipe = () =>
    Alert.alert('Delete all data?', 'This removes every cash-in and cash-out entry and every chat message from this phone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: () => deleteAllExpenses() },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: t.card }]}>
        <Text style={[styles.title, { color: t.text }]}>Preferences</Text>
        <Text style={[styles.label, { color: t.muted }]}>Currency</Text>
        <TextInput
          value={currency}
          onChangeText={setCurrency}
          autoCapitalize="none"
          placeholder="Rs"
          placeholderTextColor={t.muted}
          style={[styles.input, { color: t.text, borderColor: t.border }]}
        />
        <Text style={[styles.label, { color: t.muted }]}>Track from (YYYY-MM-DD)</Text>
        <TextInput
          value={startText}
          onChangeText={setStartText}
          placeholder="2026-11-10"
          placeholderTextColor={t.muted}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, { color: t.text, borderColor: t.border }]}
        />
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>
          Nothing before {settings.trackingStart ? formatDate(settings.trackingStart) : 'this date'} is counted, listed or
          imported from SMS. Older entries are hidden, not deleted.
        </Text>
        <Text style={[styles.label, { color: t.muted }]}>Monthly cash-out budget (optional)</Text>
        <TextInput
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
          placeholder="e.g. 100000"
          placeholderTextColor={t.muted}
          style={[styles.input, { color: t.text, borderColor: t.border }]}
        />
        <Pressable onPress={save} style={[styles.button, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.primaryText, fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: t.card }]}>
        <Text style={[styles.title, { color: t.text }]}>Your data</Text>
        <Text style={{ color: t.muted, marginBottom: 8 }}>
          Everything is stored only on this phone. Export a CSV backup now and then (you can open it in Excel or Google Sheets).
        </Text>
        <Pressable onPress={exportCsv} style={[styles.button, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.primaryText, fontWeight: '700' }}>Export CSV</Text>
        </Pressable>
        <Pressable onPress={wipe} style={[styles.button, { borderWidth: 1, borderColor: t.danger }]}>
          <Text style={{ color: t.danger, fontWeight: '700' }}>Delete all data</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: t.card }]}>
        <Text style={[styles.title, { color: t.text }]}>Tracking from messages</Text>
        <Text style={{ color: t.muted, lineHeight: 20 }}>
          • Chat tab: type “lunch 1200” for cash out or “+50000 salary” for cash in.{'\n'}
          • Share: in WhatsApp, Messages or any app, long-press a message → Share → Expense Tracker.{'\n'}
          • SMS tab (Android): import bank debit and credit alerts, or turn on auto-import.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 13, marginTop: 12, marginBottom: 6, fontWeight: '600' },
  input: { fontSize: 16, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  button: { marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
