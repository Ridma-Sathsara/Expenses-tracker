import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { ExpenseEditor } from '../components/ExpenseEditor';
import { ExpenseRow } from '../components/ExpenseRow';
import { type EntryType, getCategory } from '../lib/categories';
import { type Expense, listAllExpenses, listExpenses } from '../lib/db';
import { daysInMonth, formatDate, formatDay, formatMoney, monthLabel, monthRange, startOfDay } from '../lib/format';
import { useLoad, useSettings } from '../lib/hooks';
import { balance, cashFlow, outlook, totalsByCategory } from '../lib/ledger';
import { useTheme } from '../theme';

const DAY = 86400000;

export function HomeScreen() {
  const t = useTheme();
  const { currency, budget, trackingStart, openingBalance } = useSettings();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [from, to] = monthRange(ym.y, ym.m);
  // listExpenses already leaves out anything before the tracking start.
  const [entries] = useLoad(() => listExpenses(from, to), [] as Expense[], [from, to]);
  const [allEntries] = useLoad(() => listAllExpenses(), [] as Expense[]);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newType, setNewType] = useState<EntryType>('expense');

  const money = (n: number) => formatMoney(n, currency);
  const signedMoney = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;

  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();
  // You can't browse to months that end before tracking began.
  const isFirstMonth = from <= trackingStart;
  const shiftMonth = (d: number) => {
    const date = new Date(ym.y, ym.m + d, 1);
    setYm({ y: date.getFullYear(), m: date.getMonth() });
  };

  const stats = useMemo(() => {
    const flow = cashFlow(entries);
    const today = startOfDay(Date.now());
    const todayFlow = cashFlow(entries.filter((e) => startOfDay(e.date) === today));
    const outByCat = totalsByCategory(entries, 'expense');
    const inByCat = totalsByCategory(entries, 'income');

    // Days that actually count this month: from the tracking start (if it falls in this month) up to today.
    const firstDay = Math.max(from, startOfDay(trackingStart));
    const lastDay = isCurrentMonth ? today : to - DAY;
    const dayCount = Math.max(1, Math.round((lastDay - firstDay) / DAY) + 1);

    const dailyOut: number[] = Array.from({ length: daysInMonth(ym.y, ym.m) }, () => 0);
    for (const e of entries) if (e.type === 'expense') dailyOut[new Date(e.date).getDate() - 1] += e.amount;

    const sections: { title: string; net: number; data: Expense[] }[] = [];
    for (const e of entries) {
      const title = formatDay(e.date);
      let sec = sections[sections.length - 1];
      if (!sec || sec.title !== title) sections.push((sec = { title, net: 0, data: [] }));
      sec.data.push(e);
      sec.net += e.type === 'income' ? e.amount : -e.amount;
    }
    return { flow, todayFlow, outByCat, inByCat, avgOut: flow.cashOut / dayCount, dailyOut, sections };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, trackingStart]);

  const overall = useMemo(() => cashFlow(allEntries), [allEntries]);
  const currentBalance = balance(openingBalance, overall);
  const { flow } = stats;
  const maxDaily = Math.max(1, ...stats.dailyOut);
  const budgetPct = budget > 0 ? flow.cashOut / budget : 0;
  const hasData = flow.countIn + flow.countOut > 0;

  const openNew = (type: EntryType) => {
    setEditing(null);
    setNewType(type);
    setEditorOpen(true);
  };

  const breakdown = (title: string, rows: { category: string; total: number }[], total: number) =>
    rows.length === 0 ? null : (
      <>
        <Text style={[styles.cardTitle, { color: t.text, marginTop: 16 }]}>{title}</Text>
        {rows.map((r) => {
          const c = getCategory(r.category);
          return (
            <View key={r.category} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.text }}>
                  {c.emoji} {c.label}
                </Text>
                <Text style={{ color: t.text, fontWeight: '600' }}>
                  {money(r.total)} <Text style={{ color: t.muted }}>{Math.round((r.total / total) * 100)}%</Text>
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: t.border, marginTop: 4 }]}>
                <View style={[styles.fill, { width: `${(r.total / total) * 100}%`, backgroundColor: c.color }]} />
              </View>
            </View>
          );
        })}
      </>
    );

  const header = (
    <View>
      <View style={styles.monthRow}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={12} disabled={isFirstMonth}>
          <Text style={[styles.arrow, { color: isFirstMonth ? t.border : t.primary }]}>‹</Text>
        </Pressable>
        <Text style={[styles.month, { color: t.text }]}>{monthLabel(ym.y, ym.m)}</Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={12} disabled={isCurrentMonth}>
          <Text style={[styles.arrow, { color: isCurrentMonth ? t.border : t.primary }]}>›</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.primaryText, opacity: 0.85 }}>Net this month (in − out)</Text>
        <Text style={[styles.total, { color: t.primaryText }]}>{signedMoney(flow.net)}</Text>
        <Text style={{ color: t.primaryText, opacity: 0.95 }}>{outlook(flow, money)}</Text>
        <View style={styles.tiles}>
          <Pressable style={[styles.tile, { backgroundColor: '#FFFFFF22' }]} onPress={() => openNew('income')}>
            <Text style={{ color: t.primaryText, opacity: 0.85, fontSize: 12 }}>💰 Cash in · {flow.countIn}</Text>
            <Text style={[styles.tileValue, { color: t.primaryText }]}>{money(flow.cashIn)}</Text>
          </Pressable>
          <Pressable style={[styles.tile, { backgroundColor: '#FFFFFF22' }]} onPress={() => openNew('expense')}>
            <Text style={{ color: t.primaryText, opacity: 0.85, fontSize: 12 }}>💸 Cash out · {flow.countOut}</Text>
            <Text style={[styles.tileValue, { color: t.primaryText }]}>{money(flow.cashOut)}</Text>
          </Pressable>
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
                ? `Cash out is ${money(flow.cashOut - budget)} over your ${money(budget)} budget`
                : `${money(budget - flow.cashOut)} of your ${money(budget)} budget still free`}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.card, styles.rowBetween, { backgroundColor: t.card }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.muted, fontSize: 12 }}>Balance now</Text>
          <Text style={{ color: currentBalance >= 0 ? t.success : t.danger, fontSize: 24, fontWeight: '800' }}>
            {currentBalance < 0 ? '−' : ''}
            {money(Math.abs(currentBalance))}
          </Text>
          <Text style={{ color: t.muted, fontSize: 11 }}>since {trackingStart ? formatDate(trackingStart) : '…'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: t.muted, fontWeight: '600' }}>Started with {money(openingBalance)}</Text>
          <Text style={{ color: t.success, fontWeight: '600' }}>In {money(overall.cashIn)}</Text>
          <Text style={{ color: t.text, fontWeight: '600' }}>Out {money(overall.cashOut)}</Text>
        </View>
      </View>

      {hasData ? (
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Daily cash out</Text>
            <Text style={{ color: t.muted, fontSize: 12, marginBottom: 10 }}>
              {isCurrentMonth ? `Today ${money(stats.todayFlow.cashOut)} · ` : ''}avg {money(Math.round(stats.avgOut))}/day
            </Text>
          </View>
          <View style={styles.bars}>
            {stats.dailyOut.map((v, i) => (
              <View key={i} style={styles.barSlot}>
                <View style={[styles.bar, { height: `${(v / maxDaily) * 100}%`, backgroundColor: v > 0 ? t.primary : t.border }]} />
              </View>
            ))}
          </View>
          <View style={styles.rowBetween}>
            <Text style={{ color: t.muted, fontSize: 11 }}>1</Text>
            <Text style={{ color: t.muted, fontSize: 11 }}>{stats.dailyOut.length}</Text>
          </View>
          {breakdown('Where cash went', stats.outByCat, flow.cashOut)}
          {breakdown('Where cash came from', stats.inByCat, flow.cashIn)}
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: t.card, alignItems: 'center' }]}>
          <Text style={{ fontSize: 40 }}>🌱</Text>
          <Text style={{ color: t.text, fontWeight: '600', marginTop: 8 }}>A fresh start</Text>
          <Text style={{ color: t.muted, textAlign: 'center', marginTop: 4 }}>
            Tap + to add cash in or cash out, type “+50000 salary” or “lunch 1200” in Chat, or import your bank SMS.
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
            <Text style={{ color: section.net >= 0 ? t.success : t.muted }}>{signedMoney(section.net)}</Text>
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
      <Pressable onPress={() => openNew('expense')} style={[styles.fab, { backgroundColor: t.primary }]} accessibilityLabel="Add entry">
        <Text style={{ color: t.primaryText, fontSize: 30, lineHeight: 32 }}>+</Text>
      </Pressable>
      <ExpenseEditor
        visible={editorOpen}
        expense={editing}
        initialType={newType}
        currency={currency}
        onClose={() => setEditorOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { fontSize: 32, paddingHorizontal: 8 },
  month: { fontSize: 18, fontWeight: '700' },
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  total: { fontSize: 34, fontWeight: '800', marginVertical: 6 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 14 },
  tile: { flex: 1, borderRadius: 12, padding: 10 },
  tileValue: { fontSize: 17, fontWeight: '800', marginTop: 2 },
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
