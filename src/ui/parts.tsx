import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/** A sub screen's top bar: back on the left, then the title. */
export function SubTopBar({ title, onBack }: { title: string; onBack: () => void }) {
  const c = useColours();
  return (
    <View style={[styles.topBar, styles.subBar, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
      <IconButton icon="back" label="Back" onPress={onBack} />
      <View style={styles.topBarTitle}>
        <TopBarTitle>{title}</TopBarTitle>
      </View>
    </View>
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
/** A full-width button. `primary` is the one main action; `danger` (red text and border) is only for Cancel. */
export function Button({ label, onPress, primary, danger }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean }) {
  const c = useColours();
  return (
    <Tappable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: c.primary, borderColor: c.primary }
          : { backgroundColor: pressed ? c.tint : c.surface, borderColor: danger ? c.bad : c.input },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? c.primaryFg : danger ? c.bad : c.fg }]}>{label}</Text>
    </Tappable>
  );
}

/** A bottom sheet over a scrim: a bold title, its content, then Close. Fades when the phone asks for reduced motion. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useColours();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={[styles.scrim, { backgroundColor: c.scrim }]}>
        <Tappable style={styles.scrimTap} onPress={onClose} importantForAccessibility="no" accessible={false} />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: space.s4 + insets.bottom }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            <Text accessibilityRole="header" style={[styles.sheetTitle, { color: c.fg }]}>
              {title}
            </Text>
            {children}
            <Button label="Close" onPress={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A short message at the bottom of the screen, read out by screen readers, with an optional action such as Undo. */
export function Toast({ message, action }: { message: string; action?: { label: string; onPress: () => void } }) {
  const c = useColours();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: c.toast }]}>
      <Text style={[styles.body, styles.toastText, { color: c.toastFg }]}>{message}</Text>
      {action ? (
        <Tappable accessibilityRole="button" onPress={action.onPress} style={styles.toastAction}>
          <Text style={[styles.buttonText, { color: c.toastFg }]}>{action.label}</Text>
        </Tappable>
      ) : null}
    </View>
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
  subBar: { paddingLeft: space.s1 },
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
  scrim: { flex: 1, justifyContent: 'flex-end' },
  scrimTap: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.rL,
    borderTopRightRadius: radius.rL,
    padding: space.s4,
    maxHeight: '90%',
  },
  sheetBody: { gap: space.s4 },
  sheetTitle: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700' },
  toast: {
    position: 'absolute',
    left: space.s4,
    right: space.s4,
    bottom: space.s4,
    borderRadius: radius.r,
    paddingLeft: space.s4,
    paddingRight: space.s1,
    paddingVertical: space.s1,
    minHeight: size.touch + space.s2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  toastText: { flex: 1, paddingVertical: space.s2 },
  toastAction: {
    minHeight: size.touch,
    minWidth: size.touch,
    paddingHorizontal: space.s3,
    borderRadius: radius.r,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
