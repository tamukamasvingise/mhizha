import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useColours } from './theme';
import { lineHeight, radius, size, space, type } from './tokens';

// Shared parts of every screen. Screens use these, never their own copies.

type TappableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

/** Anything tappable. Draws the focus ring when a keyboard or switch moves focus to it. */
export function Tappable({ style, onFocus, onBlur, ...rest }: TappableProps) {
  const c = useColours();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        focused && { outlineWidth: size.ring, outlineColor: c.ring, outlineOffset: space.s05, outlineStyle: 'solid' },
      ]}
    />
  );
}

/** A 44x44 button holding one icon. `label` is what a screen reader says. */
export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useColours();
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: c.tint }]}
    >
      <Icon name={icon} colour={c.fg} />
    </Tappable>
  );
}

/** The bar at the top of a screen: content on the left, actions on the right. */
export function TopBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const c = useColours();
  return (
    <View style={[styles.topBar, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
      <View style={styles.topBarTitle}>{children}</View>
      {actions}
    </View>
  );
}

export function TopBarTitle({ children }: { children: string }) {
  const c = useColours();
  return (
    <Text accessibilityRole="header" numberOfLines={1} style={[styles.topTitle, { color: c.fg }]}>
      {children}
    </Text>
  );
}

/** What an empty screen says: a bold title, then what to do next. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  const c = useColours();
  return (
    <View style={styles.empty}>
      <Text accessibilityRole="header" style={[styles.emptyTitle, { color: c.fg }]}>
        {title}
      </Text>
      <Text style={[styles.body, styles.centre, { color: c.label }]}>{body}</Text>
    </View>
  );
}

/** A plain button: grey border on the surface, or `primary` for the one main action. */
export function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const c = useColours();
  return (
    <Tappable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: c.primary, borderColor: c.primary }
          : { backgroundColor: pressed ? c.tint : c.surface, borderColor: c.input },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? c.primaryFg : c.fg }]}>{label}</Text>
    </Tappable>
  );
}

export const styles = StyleSheet.create({
  iconButton: {
    minWidth: size.touch,
    minHeight: size.touch,
    borderRadius: radius.r,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    minHeight: size.topBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingVertical: space.s1,
    paddingLeft: space.s4,
    paddingRight: space.s1,
    borderBottomWidth: size.hairline,
  },
  topBarTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s2, minWidth: 0 },
  topTitle: { flexShrink: 1, fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  empty: {
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s8,
    paddingHorizontal: space.s4,
  },
  emptyTitle: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700', textAlign: 'center' },
  body: { fontSize: type.m, lineHeight: lineHeight(type.m) },
  small: { fontSize: type.s, lineHeight: lineHeight(type.s) },
  centre: { textAlign: 'center' },
  button: {
    minHeight: size.touch,
    borderRadius: radius.r,
    borderWidth: size.hairline,
    paddingHorizontal: space.s4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600', textAlign: 'center' },
});
