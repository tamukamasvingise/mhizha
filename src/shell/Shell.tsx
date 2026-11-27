import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, BackHandler, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Mark } from '../ui/Icon';
import { Button, EmptyState, IconButton, Tappable, TopBar, TopBarTitle, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { elevation, lineHeight, radius, size, space, type } from '../ui/tokens';
import { back, newChoices, openReport, openSettings, selectTab, start, tabs, type Place, type TabId } from './navigation';
import { ProblemReportBody } from './ProblemReport';
import { useCheckFailed, useDb } from './Records';

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
      <View style={[local.root, { backgroundColor: c.page, paddingBottom: insets.bottom }]}>
        <View style={{ height: insets.top, backgroundColor: c.surface }} />
        <Settings onBack={() => setPlace(back(place) as Place)} onReport={() => setPlace(openReport(place))} />
      </View>
    );
  }

  if (place.screen === 'report') {
    return (
      <View style={[local.root, { backgroundColor: c.page, paddingBottom: insets.bottom }]}>
        <View style={{ height: insets.top, backgroundColor: c.surface }} />
        <Report onBack={() => setPlace(back(place) as Place)} />
      </View>
    );
  }

  const tab = tabs.find((t) => t.id === place.tab) ?? tabs[0]!;

  return (
    <View style={[local.root, { backgroundColor: c.page }]}>
      <View style={{ height: insets.top, backgroundColor: c.surface }} />
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
          <CheckBanner onPress={() => setPlace(openReport(place))} />
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
          <Tappable
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
          </Tappable>
        );
      })}
    </View>
  );
}

function NewButton({ onPress }: { onPress: () => void }) {
  const c = useColours();
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel="New Quotation, Invoice, Payment or Customer"
      onPress={onPress}
      style={[local.fab, { backgroundColor: c.primary }]}
    >
      <Icon name="plus" colour={c.primaryFg} px={size.iconS} />
      <Text style={[local.fabText, { color: c.primaryFg }]}>New</Text>
    </Tappable>
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
        <Tappable style={local.scrimTap} onPress={onClose} importantForAccessibility="no" accessible={false} />
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

function Settings({ onBack, onReport }: { onBack: () => void; onReport: () => void }) {
  const c = useColours();
  const version = Constants.expoConfig?.version ?? '';
  const build = String(Constants.expoConfig?.extra?.build ?? '');
  return (
    <>
      <SubBar title="Settings" onBack={onBack} />
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
        <View style={local.section}>
          <Text accessibilityRole="header" style={[local.sectionTitle, { color: c.label }]}>
            Help
          </Text>
          <View style={[local.list, { borderColor: c.line, backgroundColor: c.surface }]}>
            <Tappable
              accessibilityRole="button"
              onPress={onReport}
              style={({ pressed }) => [local.item, pressed && { backgroundColor: c.tint }]}
            >
              <Text style={[local.itemTitle, { color: c.fg }]}>Send a problem report</Text>
              <Text style={[parts.small, { color: c.label }]}>
                A text file of logs and checks, with no Customer details. You see it before you share it.
              </Text>
            </Tappable>
          </View>
        </View>
        <Text style={[parts.body, { color: c.label }]}>
          Your business details, Document numbers and backups are set here once setup is built.
        </Text>
      </ScrollView>
    </>
  );
}

function SubBar({ title, onBack }: { title: string; onBack: () => void }) {
  const c = useColours();
  return (
    <View style={[parts.topBar, local.subBar, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
      <IconButton icon="back" label="Back" onPress={onBack} />
      <View style={parts.topBarTitle}>
        <TopBarTitle>{title}</TopBarTitle>
      </View>
    </View>
  );
}

/** The problem report, read in full before it goes to the Share menu. */
function Report({ onBack }: { onBack: () => void }) {
  const db = useDb();
  return (
    <>
      <SubBar title="Problem report" onBack={onBack} />
      <ScrollView contentContainerStyle={local.sub}>
        <ProblemReportBody db={db} />
      </ScrollView>
    </>
  );
}

/** Shown on every tab while a check on open has failed. Work goes on. */
function CheckBanner({ onPress }: { onPress: () => void }) {
  const c = useColours();
  if (!useCheckFailed()) return null;
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityHint="Opens the problem report"
      onPress={onPress}
      style={({ pressed }) => [
        local.banner,
        { backgroundColor: pressed ? c.tint : c.surface, borderColor: c.bad },
      ]}
    >
      <Text style={[local.itemTitle, { color: c.bad }]}>! A check failed. Please send a problem report.</Text>
      <Text style={[parts.small, { color: c.label }]}>Your records are still there and you can keep working.</Text>
    </Tappable>
  );
}

const local = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  main: { padding: space.s4, paddingBottom: size.fab + space.s8 + space.s4, gap: space.s4 },
  sub: { padding: space.s4, gap: space.s4 },
  banner: { borderWidth: size.hairline, borderRadius: radius.r, padding: space.s3, gap: space.s05 },
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
