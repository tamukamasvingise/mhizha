// PROTOTYPE, throwaway: Reminders on real phones. Not Mhizha code.
// "Start test" schedules one-off reminders at fixed delays plus a daily one at
// 09:00, then the phone is left alone. On each open the app lists every test
// reminder: still waiting, arrived (with the time Android showed it), or missing.
// Nothing is stored: the plan rides inside each reminder's data.
import { useCallback, useEffect, useState } from 'react';
import { AppState, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'reminders';
const DELAYS_MIN = [10, 60, 180, 480, 1440, 2160, 2880, 4320]; // 10 min to 3 days

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Row = { id: string; label: string; dueMs: number | null; arrivedMs: number[]; waiting: boolean };

const fmt = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const label = (min: number) => (min < 60 ? `${min} min` : min < 1440 ? `${min / 60} h` : `${min / 1440} days`);

async function startTest(): Promise<string> {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'Notifications are not allowed. Allow them in Settings, then press Start test again.';
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
  const start = Date.now();
  for (const min of DELAYS_MIN) {
    const due = start + min * 60_000;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Test reminder: ${label(min)}`,
        body: `Due ${fmt(due)}. Leave it here; do not swipe it away.`,
        data: { testId: `once-${min}`, label: label(min), due, start },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due, channelId: CHANNEL },
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test reminder: daily 09:00',
      body: 'Stands in for the weekly backup reminder. Leave it here.',
      data: { testId: 'daily-0900', label: 'daily 09:00', due: null, start },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0, channelId: CHANNEL },
  });
  return `Started ${fmt(start)}. Now close the app (swipe it away from recent apps).`;
}

async function readState(): Promise<{ start: number | null; rows: Row[] }> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const shown = await Notifications.getPresentedNotificationsAsync();
  const rows = new Map<string, Row>();
  let start: number | null = null;
  const take = (data: Record<string, unknown> | undefined) => {
    if (!data || typeof data.testId !== 'string') return null;
    if (typeof data.start === 'number') start = data.start;
    const id = data.testId;
    if (!rows.has(id))
      rows.set(id, { id, label: String(data.label), dueMs: (data.due as number) ?? null, arrivedMs: [], waiting: false });
    return rows.get(id)!;
  };
  for (const p of pending) {
    const r = take(p.content.data);
    if (r) r.waiting = true;
  }
  for (const n of shown) {
    const r = take(n.request.content.data);
    if (r) r.arrivedMs.push(n.date);
  }
  // Rows the phone has forgotten entirely (neither waiting nor shown) are added as missing.
  if (start !== null) {
    for (const min of DELAYS_MIN) {
      const id = `once-${min}`;
      if (!rows.has(id)) rows.set(id, { id, label: label(min), dueMs: start + min * 60_000, arrivedMs: [], waiting: false });
    }
    if (!rows.has('daily-0900')) rows.set('daily-0900', { id: 'daily-0900', label: 'daily 09:00', dueMs: null, arrivedMs: [], waiting: false });
  }
  const order = (r: Row) => (r.dueMs ?? Number.MAX_SAFE_INTEGER);
  return { start, rows: [...rows.values()].sort((a, b) => order(a) - order(b)) };
}

function status(r: Row): string {
  if (r.id === 'daily-0900') {
    const times = r.arrivedMs.sort((a, b) => a - b).map(fmt).join(', ');
    return `${r.waiting ? 'scheduled' : 'NOT SCHEDULED'}; arrived: ${times || 'none yet'}`;
  }
  if (r.arrivedMs.length) {
    const late = Math.round((r.arrivedMs[0] - (r.dueMs ?? 0)) / 60_000);
    return `arrived ${fmt(r.arrivedMs[0])} (${late >= 0 ? late + ' min late' : -late + ' min early'})`;
  }
  if (r.waiting) return r.dueMs !== null && r.dueMs < Date.now() ? 'OVERDUE, still waiting' : 'waiting';
  return 'MISSING (not shown, not waiting; swiped away?)';
}

export default function App() {
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<{ start: number | null; rows: Row[] }>({ start: null, rows: [] });
  const refresh = useCallback(() => {
    readState().then(setState).catch((e) => setMsg('Could not read reminders: ' + String(e)));
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Reminders test</Text>
      <Text style={styles.body}>Now {fmt(Date.now())}. {state.start ? `Test started ${fmt(state.start)}.` : 'No test running.'}</Text>
      {state.rows.map((r) => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.rowLabel}>{r.label}{r.dueMs ? `, due ${fmt(r.dueMs)}` : ''}</Text>
          <Text style={styles.body}>{status(r)}</Text>
        </View>
      ))}
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <View style={styles.buttons}>
        <Button title="Refresh" onPress={refresh} />
        <Button
          title="Start test (clears the old one)"
          onPress={() => startTest().then((m) => { setMsg(m); refresh(); }).catch((e) => setMsg('Failed: ' + String(e)))}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingTop: 48, gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  row: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14 },
  msg: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  buttons: { gap: 12, marginTop: 16 },
});
