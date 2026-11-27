import type { ReactNode } from 'react';
import { StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Tappable, styles as parts } from './parts';
import { useColours } from './theme';
import { lineHeight, radius, size, space, type } from './tokens';

// Form parts: text fields, choices and on/off switches. Screens use these,
// never their own copies.

type FieldProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Says what to type, under the label. */
  hint?: string;
  /** What is wrong, in plain words. Shown under the field with a "! " prefix. */
  error?: string;
};

/** A labelled text field. An error gives it a thicker red border and the message under it. */
export function Field({ label, hint, error, value, onChangeText, ...rest }: FieldProps) {
  const c = useColours();
  return (
    <View style={local.field}>
      <Text style={[local.label, { color: c.fg }]}>{label}</Text>
      {hint ? <Text style={[parts.small, { color: c.label }]}>{hint}</Text> : null}
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        accessibilityHint={error ? `${error}${hint ? ` ${hint}` : ''}` : hint}
        placeholderTextColor={c.label}
        cursorColor={c.primary}
        selectionColor={c.sel}
        style={[
          local.input,
          rest.multiline && local.multiline,
          {
            color: c.fg,
            backgroundColor: c.surface,
            borderColor: error ? c.bad : c.input,
            borderWidth: error ? size.ring - 1 : size.hairline,
          },
        ]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[local.error, { color: c.bad }]}>
          {`! ${error}`}
        </Text>
      ) : null}
    </View>
  );
}

export type ChoiceOption<T> = { value: T; label: string };

/** Pick one of a few options, shown as pills. The chosen one is orange-tinted and ticked. */
export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const c = useColours();
  return (
    <View style={local.field} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[local.label, { color: c.fg }]}>{label}</Text>
      <View style={local.pills}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Tappable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[
                local.pill,
                on
                  ? { backgroundColor: c.sel, borderColor: c.brand }
                  : { backgroundColor: c.surface, borderColor: c.input },
              ]}
            >
              <Text style={[local.pillText, { color: on ? c.selFg : c.fg, fontWeight: on ? '700' : '400' }]}>
                {on ? `✓ ${o.label}` : o.label}
              </Text>
            </Tappable>
          );
        })}
      </View>
    </View>
  );
}

/** An on/off setting with a label and an optional line saying what it does. */
export function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (on: boolean) => void;
}) {
  const c = useColours();
  return (
    <Tappable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => onChange(!value)}
      style={local.toggle}
    >
      <View style={local.toggleText}>
        <Text style={[local.label, { color: c.fg }]}>{label}</Text>
        {hint ? <Text style={[parts.small, { color: c.label }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        importantForAccessibility="no"
        trackColor={{ true: c.primary, false: c.input }}
        thumbColor={c.surface}
      />
    </Tappable>
  );
}

/** A group of fields under a small heading. */
export function FieldGroup({ title, children }: { title?: string; children: ReactNode }) {
  const c = useColours();
  return (
    <View style={local.group}>
      {title ? (
        <Text accessibilityRole="header" style={[local.groupTitle, { color: c.label }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const local = StyleSheet.create({
  field: { gap: space.s1 },
  label: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  input: {
    minHeight: size.touch,
    borderRadius: radius.r,
    paddingHorizontal: space.s3,
    fontSize: type.m,
  },
  multiline: { paddingVertical: space.s2, textAlignVertical: 'top' },
  error: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  pill: {
    minHeight: size.touch,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    paddingHorizontal: space.s4,
    justifyContent: 'center',
  },
  pillText: { fontSize: type.m, lineHeight: lineHeight(type.m) },
  toggle: { minHeight: size.topBar, flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  toggleText: { flex: 1, gap: space.s05 },
  group: { gap: space.s3 },
  groupTitle: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '600' },
});
