import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getCategory } from '../lib/categories';
import { deleteAllExpenses, listAllExpenses } from '../lib/db';
import { toIsoDate, formatTime } from '../lib/format';
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

  useEffect(() => setCurrency(settings.currency), [settings.currency]);
  useEffect(() => setBudget(settings.budget ? String(settings.budget) : ''), [settings.budget]);

  const save = async () => {
    const raw = currency.trim().slice(0, 6);
    // Keep "Rs" as typed; upper-case codes like lkr -> LKR.
    const cur = /^rs\.?$/i.test(raw) ? 'Rs' : raw.toUpperCase();
    const b = budget.trim() ? Number(budget.replace(/,/g, '')) : 0;
    if (!cur) return Alert.alert('Currency is required', 'For example Rs, LKR or USD.');
    if (!Number.isFinite(b) || b < 0) return Alert.alert('Invalid budget', 'Enter a number, or leave it empty.');
    await settings.update('currency', cur);
    await settings.update('currencyUserSet', '1');
    await settings.update('budget', String(b));
    Alert.alert('Saved');
  };

  const exportCsv = async () => {
    const all = await listAllExpenses();
    if (all.length === 0) return Alert.alert('Nothing to export yet');
    const header = 'date,time,amount,currency,category,note,merchant,source';
    const rows = all.map((e) =>
      [toIsoDate(e.date), formatTime(e.date), e.amount, settings.currency, getCategory(e.category).label, e.note, e.merchant, e.source]
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
    Alert.alert('Delete all data?', 'This removes every expense and chat message from this phone. This cannot be undone.', [
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
        <Text style={[styles.label, { color: t.muted }]}>Monthly budget (optional)</Text>
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
          • Chat tab: type “lunch 1200” like a text message.{'\n'}
          • Share: in WhatsApp, Messages or any app, long-press a message → Share → Expense Tracker.{'\n'}
          • SMS tab (Android): import bank alerts, or turn on auto-import.
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
