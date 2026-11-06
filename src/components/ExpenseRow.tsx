import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCategory } from '../lib/categories';
import type { Expense } from '../lib/db';
import { formatMoney, formatTime } from '../lib/format';
import { useTheme } from '../theme';

const SOURCE_LABEL: Record<Expense['source'], string> = {
  manual: '',
  chat: '💬 chat',
  sms: '✉️ SMS',
  share: '↗️ shared',
};

export function ExpenseRow({ expense, currency, onPress }: { expense: Expense; currency: string; onPress?: () => void }) {
  const t = useTheme();
  const c = getCategory(expense.category);
  const source = SOURCE_LABEL[expense.source];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: c.color + '22' }]}>
        <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.note, { color: t.text }]} numberOfLines={1}>
          {expense.note}
        </Text>
        <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
          {c.label} · {formatTime(expense.date)}
          {source ? ` · ${source}` : ''}
        </Text>
      </View>
      <Text style={[styles.amount, { color: t.text }]}>{formatMoney(expense.amount, currency)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 15, fontWeight: '700' },
});
