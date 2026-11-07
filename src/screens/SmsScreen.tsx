import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { hasSmsPermission, isSmsSupported, requestSmsPermission } from '../../modules/sms-reader';
import { getCategory } from '../lib/categories';
import { clearIgnoredSms, countIgnoredSms, ignoreSms, setSetting } from '../lib/db';
import { formatDay, formatMoney } from '../lib/format';
import { useSettings } from '../lib/hooks';
import { findSmsExpenses, getBlockedSenders, importSmsCandidates, setBlockedSenders, type SmsCandidate } from '../lib/sms';
import { useTheme } from '../theme';

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 365, label: '1 year' },
];

export function SmsScreen() {
  const t = useTheme();
  const { currency, smsAutoImport } = useSettings();
  const [granted, setGranted] = useState(hasSmsPermission());
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SmsCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState(0);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [newSender, setNewSender] = useState('');

  const scan = useCallback(async () => {
    if (!granted) return;
    setLoading(true);
    try {
      const found = await findSmsExpenses(days);
      // Clear expenses first, then the "maybe" ones; newest first within each group.
      found.sort((a, b) => Number(b.sure) - Number(a.sure) || b.sms.date - a.sms.date);
      setItems(found);
      setSelected(new Set(found.filter((f) => f.sure).map((f) => f.sms.id)));
      setSkipped(await countIgnoredSms());
      setBlocked(await getBlockedSenders());
    } catch (e) {
      Alert.alert('Could not read SMS', String(e));
    } finally {
      setLoading(false);
    }
  }, [days, granted]);

  useEffect(() => {
    scan();
  }, [scan]);

  if (!isSmsSupported) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={{ fontSize: 40 }}>📵</Text>
        <Text style={[styles.h, { color: t.text }]}>SMS reading isn’t available here</Text>
        <Text style={{ color: t.muted, textAlign: 'center' }}>
          Only Android lets apps read SMS. You can still copy a bank message and paste it into Chat, or use your phone's Share
          button to send it to Expense Tracker.
        </Text>
      </View>
    );
  }

  if (!granted) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={{ fontSize: 40 }}>✉️</Text>
        <Text style={[styles.h, { color: t.text }]}>Track spending from bank SMS</Text>
        <Text style={{ color: t.muted, textAlign: 'center', marginBottom: 20 }}>
          Allow access to your SMS so the app can find bank and card alerts like “LKR 2,500 debited at …” and log them as expenses.
          Messages are read only on this phone and never uploaded anywhere.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: t.primary }]}
          onPress={async () => setGranted(await requestSmsPermission())}
        >
          <Text style={{ color: t.primaryText, fontWeight: '700', fontSize: 16 }}>Allow SMS access</Text>
        </Pressable>
      </View>
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const importSelected = async () => {
    const chosen = items.filter((i) => selected.has(i.sms.id));
    const skipped = items.filter((i) => !selected.has(i.sms.id)).map((i) => i.sms.id);
    await importSmsCandidates(chosen);
    await ignoreSms(skipped);
    await setSetting('smsLastSync', String(Date.now()));
    Alert.alert('Done', `Imported ${chosen.length} expense${chosen.length === 1 ? '' : 's'}.`);
    scan();
  };

  const updateBlocked = async (list: string[]) => {
    await setBlockedSenders(list);
    setNewSender('');
    scan();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.card, { backgroundColor: t.card, margin: 16, marginBottom: 8 }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Auto-import new bank SMS</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>Every time you open the app, new alerts are added automatically.</Text>
          </View>
          <Switch
            value={smsAutoImport}
            onValueChange={async (v) => {
              await setSetting('smsAutoImport', v ? '1' : '0');
              if (v) await setSetting('smsLastSync', String(Date.now()));
            }}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: t.card, marginHorizontal: 16, marginBottom: 8 }]}>
        <Text style={{ color: t.text, fontWeight: '700' }}>Ignored senders</Text>
        <Text style={{ color: t.muted, fontSize: 12, marginBottom: 8 }}>
          SMS from these senders are never counted as expenses (already-imported ones are removed).
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {blocked.map((b) => (
            <Pressable
              key={b}
              onPress={() =>
                Alert.alert(`Track ${b} again?`, `SMS from ${b} will be counted as expenses again.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unblock', onPress: () => updateBlocked(blocked.filter((x) => x !== b)) },
                ])
              }
              style={[styles.chip, { borderColor: t.danger }]}
            >
              <Text style={{ color: t.text }}>🚫 {b} ✕</Text>
            </Pressable>
          ))}
          <TextInput
            value={newSender}
            onChangeText={setNewSender}
            placeholder="Add sender, e.g. HNB"
            placeholderTextColor={t.muted}
            autoCapitalize="characters"
            onSubmitEditing={() => newSender.trim() && updateBlocked([...blocked, newSender])}
            returnKeyType="done"
            style={[styles.senderInput, { color: t.text, borderColor: t.border }]}
          />
        </View>
      </View>

      <View style={[styles.rowBetween, { paddingHorizontal: 16 }]}>
        <Text style={{ color: t.muted, fontWeight: '600' }}>Scan last</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {RANGES.map((r) => (
            <Pressable
              key={r.days}
              onPress={() => setDays(r.days)}
              style={[styles.chip, { borderColor: r.days === days ? t.primary : t.border, backgroundColor: r.days === days ? t.primary + '22' : 'transparent' }]}
            >
              <Text style={{ color: t.text }}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={t.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.sms.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 8 }}
          ListEmptyComponent={
            <Text style={{ color: t.muted, textAlign: 'center', marginTop: 40 }}>
              No new bank transactions found in this period.
            </Text>
          }
          ListFooterComponent={
            skipped > 0 ? (
              <Pressable
                onPress={async () => {
                  await clearIgnoredSms();
                  scan();
                }}
                style={{ paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ color: t.primary, fontWeight: '600' }}>
                  Show {skipped} skipped message{skipped === 1 ? '' : 's'} again
                </Text>
              </Pressable>
            ) : undefined
          }
          renderItem={({ item }) => {
            const on = selected.has(item.sms.id);
            const c = getCategory(item.expense.category);
            return (
              <Pressable onPress={() => toggle(item.sms.id)} style={[styles.card, { backgroundColor: t.card, borderColor: on ? t.primary : t.border, borderWidth: 1 }]}>
                <View style={styles.rowBetween}>
                  <Text style={{ color: t.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {on ? '☑️' : '⬜'} {c.emoji} {item.expense.note}
                  </Text>
                  {!item.sure ? (
                    <Text style={[styles.maybe, { color: t.muted, borderColor: t.border }]}>Maybe</Text>
                  ) : null}
                  <Text style={{ color: t.text, fontWeight: '700' }}>{formatMoney(item.expense.amount, currency)}</Text>
                </View>
                <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                  {formatDay(item.sms.date)} · from {item.sms.address ?? 'unknown'}
                </Text>
                <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }} numberOfLines={3}>
                  {item.sms.body}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {items.length > 0 && !loading ? (
        <View style={styles.footer}>
          <Pressable style={[styles.button, { backgroundColor: t.primary, flex: 1 }]} onPress={importSelected}>
            <Text style={{ color: t.primaryText, fontWeight: '700', fontSize: 16 }}>
              Import {selected.size} of {items.length}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  h: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  card: { borderRadius: 14, padding: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  senderInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, minWidth: 150, fontSize: 14 },
  maybe: { fontSize: 11, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, marginRight: 8 },
  footer: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row' },
});
