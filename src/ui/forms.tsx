import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { dateOf, longDate, plainDate } from '../dates';
import { Icon, type IconName } from './Icon';
import { Tappable, Toast, styles as parts } from './parts';
import { useColours } from './theme';
import { lineHeight, radius, size, space, type } from './tokens';

// More shared parts: list sections and rows, a choice between a few options, a
// date field, and a toast that goes by itself. Screens use these, never their own copies.

/** A group on a screen: a 14/600 `label` heading, an optional small action at the right, then its content. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const c = useColours();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.label }]}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** A list card: `surface`, hairline border, radius 8. Its rows are `Row`s. */
export function List({ children }: { children: ReactNode }) {
  const c = useColours();
  return <View style={[styles.list, { borderColor: c.line, backgroundColor: c.surface }]}>{children}</View>;
}

/**
 * A list row: title, optional subtitle and something at the right. With
 * `onPress` it opens something and ends in a chevron. `first` drops the divider above it.
 */
export function Row({
  title,
  subtitle,
  right,
  onPress,
  first,
  label,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  /** What a screen reader says, if more than the title and subtitle. */
  label?: string;
}) {
  const c = useColours();
  const body = (
    <>
      <View style={styles.rowText}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: c.fg }]}>
          {title}
        </Text>
        {subtitle ? <Text style={[parts.small, { color: c.label }]}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Icon name="next" colour={c.label} px={size.iconS} /> : null}
    </>
  );
  const divider = first ? null : { borderTopWidth: size.hairline, borderTopColor: c.line };
  const name = label ?? [title, subtitle].filter(Boolean).join(', ');
  if (!onPress)
    return (
      <View accessible accessibilityLabel={name} style={[styles.row, divider]}>
        {body}
      </View>
    );
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider, pressed && { backgroundColor: c.tint }]}
    >
      {body}
    </Tappable>
  );
}

/** A small grey button with an optional icon, for actions beside a heading or a figure. */
export function SmallButton({ label, icon, onPress, a11yLabel }: { label: string; icon?: IconName; onPress: () => void; a11yLabel?: string }) {
  const c = useColours();
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.small, { borderColor: c.input, backgroundColor: pressed ? c.tint : c.surface }]}
    >
      {icon ? <Icon name={icon} colour={c.fg} px={size.iconS} /> : null}
      <Text style={[styles.smallText, { color: c.fg }]}>{label}</Text>
    </Tappable>
  );
}

/** A choice of one among a few options, shown as pills: the chosen one in `sel` with a "✓ ". */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  error?: string;
}) {
  const c = useColours();
  return (
    <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[styles.fieldLabel, { color: c.fg }]}>{label}</Text>
      <View style={styles.pills}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Tappable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[
                styles.pill,
                on ? { backgroundColor: c.sel, borderColor: c.brand } : { backgroundColor: c.surface, borderColor: c.input },
              ]}
            >
              <Text style={[styles.pillText, { color: on ? c.selFg : c.fg, fontWeight: on ? '700' : '400' }]}>
                {on ? `✓ ${o.label}` : o.label}
              </Text>
            </Tappable>
          );
        })}
      </View>
      {error ? <Text style={[parts.small, { color: c.bad }]}>{`! ${error}`}</Text> : null}
    </View>
  );
}

/**
 * A plain date (YYYY-MM-DD) picked from the phone's calendar. Shows "Not set"
 * when empty. `min` and `max` bound the calendar.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  error,
  min,
  max,
  empty = 'Not set',
}: {
  label: string;
  value: string;
  onChange: (plain: string) => void;
  hint?: string;
  error?: string;
  min?: string;
  max?: string;
  empty?: string;
}) {
  const c = useColours();
  const [iosOpen, setIosOpen] = useState(false);
  const shown = value ? longDate(value) : empty;
  const start = value ? dateOf(value) : min ? dateOf(min) : new Date();
  const pick = () => {
    if (Platform.OS !== 'android') return setIosOpen(true);
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      minimumDate: min ? dateOf(min) : undefined,
      maximumDate: max ? dateOf(max) : undefined,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(plainDate(date));
      },
    });
  };
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.fg }]}>{label}</Text>
      {hint ? <Text style={[parts.small, { color: c.label }]}>{hint}</Text> : null}
      <Tappable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown}`}
        accessibilityHint={error ?? 'Opens the calendar'}
        onPress={pick}
        style={({ pressed }) => [
          styles.dateInput,
          { borderColor: error ? c.bad : c.input, backgroundColor: pressed ? c.tint : c.surface },
        ]}
      >
        <Text style={[parts.body, styles.dateText, { color: value ? c.fg : c.label }]}>{shown}</Text>
        <Icon name="calendar" colour={c.label} px={size.iconS} />
      </Tappable>
      {error ? <Text style={[parts.small, { color: c.bad }]}>{`! ${error}`}</Text> : null}
      {iosOpen ? (
        <DateTimePicker
          value={start}
          mode="date"
          minimumDate={min ? dateOf(min) : undefined}
          maximumDate={max ? dateOf(max) : undefined}
          onChange={(event, date) => {
            setIosOpen(false);
            if (event.type === 'set' && date) onChange(plainDate(date));
          }}
        />
      ) : null}
    </View>
  );
}

/** A toast that goes by itself after 5 s. Call `show` with the message, and an optional action such as Undo. */
export function useToast() {
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onPress: () => void }; n: number } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = (message: string, action?: { label: string; onPress: () => void }) => {
    if (timer.current) clearTimeout(timer.current);
    setToast((t) => ({ message, action, n: (t?.n ?? 0) + 1 }));
    timer.current = setTimeout(() => setToast(null), 5000);
  };
  const view = toast ? (
    <Toast
      key={toast.n}
      message={toast.message}
      action={
        toast.action && {
          label: toast.action.label,
          onPress: () => {
            setToast(null);
            toast.action!.onPress();
          },
        }
      }
    />
  ) : null;
  return { show, view };
}

const styles = StyleSheet.create({
  section: { gap: space.s2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s2, minHeight: size.touch },
  sectionTitle: { flexShrink: 1, fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '600' },
  list: { borderWidth: size.hairline, borderRadius: radius.r, overflow: 'hidden' },
  row: { minHeight: size.topBar, padding: space.s3, flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  rowText: { flex: 1, gap: space.s05 },
  rowTitle: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  small: {
    minHeight: size.touch,
    borderRadius: radius.r,
    borderWidth: size.hairline,
    paddingHorizontal: space.s3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  smallText: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  field: { gap: space.s1 },
  fieldLabel: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  pill: {
    minHeight: size.touch,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    paddingHorizontal: space.s4,
    justifyContent: 'center',
  },
  pillText: { fontSize: type.m, lineHeight: lineHeight(type.m) },
  dateInput: {
    minHeight: size.touch,
    borderRadius: radius.r,
    borderWidth: size.hairline,
    paddingHorizontal: space.s3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  dateText: { flex: 1 },
});
