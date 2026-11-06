import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { ExpenseEditor } from '../components/ExpenseEditor';
import { ExpenseRow } from '../components/ExpenseRow';
import { CATEGORIES } from '../lib/categories';
import { type Expense, listExpenses } from '../lib/db';
import { daysInMonth, formatDay, formatMoney, monthLabel, monthRange, startOfDay } from '../lib/format';
import { useLoad, useSettings } from '../lib/hooks';
import { useTheme } from '../theme';

export function HomeScreen() {
  const t = useTheme();
  const { currency, budget } = useSettings();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [from, to] = monthRange(ym.y, ym.m);
  const [expenses] = useLoad(() => listExpenses(from, to), [] as Expense[], [from, to]);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const shiftMonth = (d: number) => {
    const date = new Date(ym.y, ym.m + d, 1);
    setYm({ y: date.getFullYear(), m: date.getMonth() });
  };

  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const today = startOfDay(Date.now());
    const todayTotal = expenses.filter((e) => startOfDay(e.date) === today).reduce((s, e) => s + e.amount, 0);
    const byCat = CATEGORIES.map((c) => ({
      ...c,
      total: expenses.filter((e) => e.category === c.id).reduce((s, e) => s + e.amount, 0),
    }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
    const dayCount = isCurrentMonth ? now.getDate() : daysInMonth(ym.y, ym.m);
    const daily: number[] = Array.from({ length: daysInMonth(ym.y, ym.m) }, () => 0);
    for (const e of expenses) daily[new Date(e.date).getDate() - 1] += e.amount;
    const sections: { title: string; total: number; data: Expense[] }[] = [];
    for (const e of expenses) {
      const title = formatDay(e.date);
      let sec = sections[sections.length - 1];
      if (!sec || sec.title !== title) sections.push((sec = { title, total: 0, data: [] }));
      sec.data.push(e);
      sec.total += e.amount;
    }
    return { total, todayTotal, byCat, avg: total / Math.max(1, dayCount), daily, sections };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const maxDaily = Math.max(1, ...stats.daily);
  const budgetPct = budget > 0 ? stats.total / budget : 0;

  const header = (
    <View>
      <View style={styles.monthRow}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={12}>
          <Text style={[styles.arrow, { color: t.primary }]}>‹</Text>
        </Pressable>
        <Text style={[styles.month, { color: t.text }]}>{monthLabel(ym.y, ym.m)}</Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={12} disabled={isCurrentMonth}>
          <Text style={[styles.arrow, { color: isCurrentMonth ? t.border : t.primary }]}>›</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.primaryText, opacity: 0.85 }}>Spent this month</Text>
        <Text style={[styles.total, { color: t.primaryText }]}>{formatMoney(stats.total, currency)}</Text>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          {isCurrentMonth ? (
            <Text style={{ color: t.primaryText, opacity: 0.85 }}>Today: {formatMoney(stats.todayTotal, currency)}</Text>
          ) : null}
          <Text style={{ color: t.primaryText, opacity: 0.85 }}>Daily avg: {formatMoney(Math.round(stats.avg), currency)}</Text>
        </View>
        {budget > 0 ? (
          <View style={{ marginTop: 12 }}>
            <View style={[styles.track, { backgroundColor: '#FFFFFF33' }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, budgetPct * 100)}%`, backgroundColor: budgetPct > 1 ? '#FCA5A5' : '#FFFFFF' },
                ]}
              />
            </View>
            <Text style={{ color: t.primaryText, opacity: 0.85, marginTop: 4, fontSize: 12 }}>
              {budgetPct > 1
                ? `Over budget by ${formatMoney(stats.total - budget, currency)}`
                : `${formatMoney(budget - stats.total, currency)} left of ${formatMoney(budget, currency)} budget`}
            </Text>
          </View>
        ) : null}
      </View>

      {stats.total > 0 ? (
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Daily spending</Text>
          <View style={styles.bars}>
            {stats.daily.map((v, i) => (
              <View key={i} style={styles.barSlot}>
                <View style={[styles.bar, { height: `${(v / maxDaily) * 100}%`, backgroundColor: v > 0 ? t.primary : t.border }]} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: t.muted, fontSize: 11 }}>1</Text>
            <Text style={{ color: t.muted, fontSize: 11 }}>{stats.daily.length}</Text>
          </View>

          <Text style={[styles.cardTitle, { color: t.text, marginTop: 16 }]}>By category</Text>
          {stats.byCat.map((c) => (
            <View key={c.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.text }}>
                  {c.emoji} {c.label}
                </Text>
                <Text style={{ color: t.text, fontWeight: '600' }}>
                  {formatMoney(c.total, currency)} <Text style={{ color: t.muted }}>{Math.round((c.total / stats.total) * 100)}%</Text>
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: t.border, marginTop: 4 }]}>
                <View style={[styles.fill, { width: `${(c.total / stats.total) * 100}%`, backgroundColor: c.color }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: t.card, alignItems: 'center' }]}>
          <Text style={{ fontSize: 40 }}>🧾</Text>
          <Text style={{ color: t.text, fontWeight: '600', marginTop: 8 }}>No expenses yet</Text>
          <Text style={{ color: t.muted, textAlign: 'center', marginTop: 4 }}>
            Tap + to add one, type “lunch 1200” in Chat, or import your bank SMS.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={stats.sections}
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={{ color: t.muted, fontWeight: '700' }}>{section.title}</Text>
            <Text style={{ color: t.muted }}>{formatMoney(section.total, currency)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: t.card, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6 }}>
            <ExpenseRow
              expense={item}
              currency={currency}
              onPress={() => {
                setEditing(item);
                setEditorOpen(true);
              }}
            />
          </View>
        )}
      />
      <Pressable
        onPress={() => {
          setEditing(null);
          setEditorOpen(true);
        }}
        style={[styles.fab, { backgroundColor: t.primary }]}
        accessibilityLabel="Add expense"
      >
        <Text style={{ color: t.primaryText, fontSize: 30, lineHeight: 32 }}>+</Text>
      </Pressable>
      <ExpenseEditor visible={editorOpen} expense={editing} currency={currency} onClose={() => setEditorOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  arrow: { fontSize: 32, paddingHorizontal: 8 },
  month: { fontSize: 18, fontWeight: '700' },
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  total: { fontSize: 34, fontWeight: '800', marginVertical: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  bars: { flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 2, minHeight: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
