import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Mark } from '../ui/Icon';
import { Button, EmptyState, IconButton, TopBar, TopBarTitle, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { elevation, lineHeight, radius, size, space, type } from '../ui/tokens';
import { back, newChoices, openSettings, selectTab, start, tabs, type Place, type TabId } from './navigation';

// The app shell: top bar with the Mhizha mark and Settings, the current tab,
// the New button and the four bottom tabs.

export function Shell() {
  const c = useColours();
  const insets = useSafeAreaInsets();
  const [place, setPlace] = useState<Place>(start);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const next = back(place);
      if (next === 'exit') return false;
      setPlace(next);
      return true;
    });
    return () => sub.remove();
  }, [place]);

  if (place.screen === 'settings') {
    return (
      <View style={[local.root, { backgroundColor: c.page, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Settings onBack={() => setPlace(back(place) as Place)} />
      </View>
    );
  }

  const tab = tabs.find((t) => t.id === place.tab) ?? tabs[0]!;

  return (
    <View style={[local.root, { backgroundColor: c.page, paddingTop: insets.top }]}>
      <TopBar actions={<IconButton icon="gear" label="Settings" onPress={() => setPlace(openSettings(place))} />}>
        {tab.id === 'home' ? (
          <View style={local.mark} accessible accessibilityRole="header" accessibilityLabel="Mhizha">
            <Mark colour={c.brand} />
            <Text style={[local.markText, { color: c.fg }]}>Mhizha</Text>
          </View>
        ) : (
          <TopBarTitle>{tab.label}</TopBarTitle>
        )}
      </TopBar>
      <View style={local.content}>
        <ScrollView contentContainerStyle={local.main}>
          <EmptyState title={tab.empty.title} body={tab.empty.body} />
        </ScrollView>
        <NewButton onPress={() => setNewOpen(true)} />
      </View>
      <TabBar current={place.tab} onSelect={(id) => setPlace(selectTab(place, id))} bottom={insets.bottom} />
      <NewSheet visible={newOpen} onClose={() => setNewOpen(false)} bottom={insets.bottom} />
    </View>
  );
}

function TabBar({ current, onSelect, bottom }: { current: TabId; onSelect: (id: TabId) => void; bottom: number }) {
  const c = useColours();
  return (
    <View
      accessibilityRole="tablist"
      style={[local.tabs, { backgroundColor: c.surface, borderTopColor: c.line, paddingBottom: bottom }]}
    >
      {tabs.map((t) => {
        const on = t.id === current;
        const fg = on ? c.selFg : c.label;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            onPress={() => onSelect(t.id)}
            style={local.tab}
          >
            <View style={[local.pill, on && { backgroundColor: c.sel }]}>
              <Icon name={t.icon} colour={fg} />
            </View>
            <Text numberOfLines={1} style={[parts.small, { color: fg, fontWeight: on ? '700' : '400' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NewButton({ onPress }: { onPress: () => void }) {
  const c = useColours();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New Quotation, Invoice, Payment or Customer"
      onPress={onPress}
      style={[local.fab, { backgroundColor: c.primary }]}
    >
      <Icon name="plus" colour={c.primaryFg} px={size.iconS} />
      <Text style={[local.fabText, { color: c.primaryFg }]}>New</Text>
    </Pressable>
  );
}

function NewSheet({ visible, onClose, bottom }: { visible: boolean; onClose: () => void; bottom: number }) {
  const c = useColours();
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
      <View style={[local.scrim, { backgroundColor: c.scrim }]}>
        <Pressable style={local.scrimTap} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          accessibilityViewIsModal
          style={[local.sheet, { backgroundColor: c.surface, paddingBottom: space.s4 + bottom }]}
        >
          <Text accessibilityRole="header" style={[local.sheetTitle, { color: c.fg }]}>
            Make something new
          </Text>
          <View style={[local.list, { borderColor: c.line }]}>
            {newChoices.map((choice, i) => (
              <View
                key={choice}
                accessible
                style={[local.item, i > 0 && { borderTopWidth: size.hairline, borderTopColor: c.line }]}
              >
                <Text style={[local.itemTitle, { color: c.fg }]}>{choice}</Text>
                <Text style={[parts.small, { color: c.label }]}>Comes in a later test build</Text>
              </View>
            ))}
          </View>
          <Button label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function Settings({ onBack }: { onBack: () => void }) {
  const c = useColours();
  const version = Constants.expoConfig?.version ?? '';
  const build = String(Constants.expoConfig?.extra?.build ?? '');
  return (
    <>
      <View style={[parts.topBar, local.subBar, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
        <IconButton icon="back" label="Back" onPress={onBack} />
        <View style={parts.topBarTitle}>
          <TopBarTitle>Settings</TopBarTitle>
        </View>
      </View>
      <ScrollView contentContainerStyle={local.main}>
        <View style={local.section}>
          <Text accessibilityRole="header" style={[local.sectionTitle, { color: c.label }]}>
            About
          </Text>
          <View style={[local.list, { borderColor: c.line, backgroundColor: c.surface }]}>
            <View accessible style={local.item}>
              <Text style={[local.itemTitle, { color: c.fg }]}>
                Mhizha {version} (build {build})
              </Text>
              <Text style={[parts.small, { color: c.label }]}>Test build. Light and dark follow your phone.</Text>
            </View>
          </View>
        </View>
        <Text style={[parts.body, { color: c.label }]}>
          Your business details, Document numbers and backups are set here once setup is built.
        </Text>
      </ScrollView>
    </>
  );
}

const local = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  main: { padding: space.s4, paddingBottom: size.fab + space.s8 + space.s4, gap: space.s4 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  markText: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700' },
  subBar: { paddingLeft: space.s1 },
  tabs: { flexDirection: 'row', borderTopWidth: size.hairline },
  tab: {
    flex: 1,
    minHeight: size.tab,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
    paddingVertical: space.s2,
  },
  pill: {
    width: size.tabPillW,
    height: size.tabPillH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: space.s4,
    bottom: space.s4,
    minHeight: size.fab,
    borderRadius: radius.rL,
    paddingLeft: space.s3,
    paddingRight: space.s4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    elevation: elevation.fab,
  },
  fabText: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700' },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  scrimTap: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.rL,
    borderTopRightRadius: radius.rL,
    padding: space.s4,
    gap: space.s4,
  },
  sheetTitle: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700' },
  section: { gap: space.s2 },
  sectionTitle: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '600' },
  list: { borderWidth: size.hairline, borderRadius: radius.r, overflow: 'hidden' },
  item: { minHeight: size.topBar, padding: space.s3, justifyContent: 'center', gap: space.s05 },
  itemTitle: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
});
