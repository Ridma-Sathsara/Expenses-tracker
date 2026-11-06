import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, type CategoryId, guessCategory } from '../lib/categories';
import { addExpense, deleteExpense, type Expense, updateExpense } from '../lib/db';
import { fromIsoDate, toIsoDate } from '../lib/format';
import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  expense: Expense | null; // null = new expense
  currency: string;
  onClose: () => void;
};

const DAY = 86400000;

export function ExpenseEditor({ visible, expense, currency, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<CategoryId>('other');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [dateText, setDateText] = useState(toIsoDate(Date.now()));

  useEffect(() => {
    if (!visible) return;
    setAmount(expense ? String(expense.amount) : '');
    setNote(expense?.note ?? '');
    setCategory(expense?.category ?? 'other');
    setCategoryTouched(!!expense);
    setDateText(toIsoDate(expense?.date ?? Date.now()));
  }, [visible, expense]);

  const onNoteChange = (v: string) => {
    setNote(v);
    if (!categoryTouched) setCategory(guessCategory(v));
  };

  const save = async () => {
    const value = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Enter an amount', 'The amount must be a number greater than 0.');
      return;
    }
    const parsedDate = fromIsoDate(dateText);
    if (parsedDate == null) {
      Alert.alert('Invalid date', 'Use the format YYYY-MM-DD, e.g. 2026-11-06.');
      return;
    }
    // Keep the current time of day when the date is today, otherwise use midday.
    const date = toIsoDate(parsedDate) === toIsoDate(Date.now()) ? Date.now() : parsedDate;
    const data = { amount: Math.round(value * 100) / 100, note: note.trim() || 'Expense', category, date };
    if (expense) {
      // Keep the original timestamp if the day didn't change.
      const sameDay = toIsoDate(expense.date) === toIsoDate(parsedDate);
      await updateExpense(expense.id, { ...data, date: sameDay ? expense.date : date });
    } else {
      await addExpense({ ...data, source: 'manual' });
    }
    onClose();
  };

  const remove = () => {
    if (!expense) return;
    Alert.alert('Delete expense?', `${expense.note}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(expense.id);
          onClose();
        },
      },
    ]);
  };

  const quickDates = [
    { label: 'Today', value: toIsoDate(Date.now()) },
    { label: 'Yesterday', value: toIsoDate(Date.now() - DAY) },
    { label: '2 days ago', value: toIsoDate(Date.now() - 2 * DAY) },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>{expense ? 'Edit expense' : 'New expense'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ color: t.muted, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: t.muted }]}>Amount ({currency})</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={t.muted}
              autoFocus={!expense}
              style={[styles.amountInput, { color: t.text, borderColor: t.border }]}
            />
            <Text style={[styles.label, { color: t.muted }]}>What for?</Text>
            <TextInput
              value={note}
              onChangeText={onNoteChange}
              placeholder="e.g. Lunch at office"
              placeholderTextColor={t.muted}
              style={[styles.input, { color: t.text, borderColor: t.border }]}
            />
            <Text style={[styles.label, { color: t.muted }]}>Category</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => {
                const active = c.id === category;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setCategory(c.id);
                      setCategoryTouched(true);
                    }}
                    style={[
                      styles.chip,
                      { borderColor: active ? c.color : t.border, backgroundColor: active ? c.color + '22' : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: t.text }}>
                      {c.emoji} {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.label, { color: t.muted }]}>Date</Text>
            <View style={styles.chips}>
              {quickDates.map((d) => {
                const active = d.value === dateText;
                return (
                  <Pressable
                    key={d.label}
                    onPress={() => setDateText(d.value)}
                    style={[styles.chip, { borderColor: active ? t.primary : t.border, backgroundColor: active ? t.primary + '22' : 'transparent' }]}
                  >
                    <Text style={{ color: t.text }}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={dateText}
              onChangeText={setDateText}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={t.muted}
              style={[styles.input, { color: t.text, borderColor: t.border }]}
            />
            {expense?.raw ? (
              <>
                <Text style={[styles.label, { color: t.muted }]}>Original message</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{expense.raw}</Text>
              </>
            ) : null}
            <Pressable onPress={save} style={[styles.button, { backgroundColor: t.primary }]}>
              <Text style={[styles.buttonText, { color: t.primaryText }]}>Save</Text>
            </Pressable>
            {expense ? (
              <Pressable onPress={remove} style={[styles.button, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.buttonText, { color: t.danger }]}>Delete</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 13, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  amountInput: { fontSize: 32, fontWeight: '700', borderBottomWidth: 1, paddingVertical: 6 },
  input: { fontSize: 16, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  button: { marginTop: 18, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
