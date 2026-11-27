import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Mark } from '../ui/Icon';
import { CustomersTab } from '../people/screens/CustomersTab';
import { SubScreen } from '../people/screens/SubScreen';
import { priceItems } from '../prices/priceList';
import { PriceListScreen } from '../prices/PriceListScreen';
import { EmptyState, IconButton, Sheet, SubTopBar, Tappable, TopBar, TopBarTitle, styles as parts } from '../ui/parts';
import { Row } from '../ui/forms';
import { useColours } from '../ui/theme';
import { elevation, lineHeight, radius, size, space, type } from '../ui/tokens';
import { SettingsPageScreen, SetupSettings } from '../setup/SettingsPages';
import { useDb } from './Records';
import {
  back,
  current,
  newChoices,
  open,
  openPriceList,
  openSettings,
  openSettingsPage,
  replace,
  selectTab,
  start,
  tabs,
  type Place,
  type SettingsPage,
  type Sub,
  type TabId,
} from './navigation';

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

  const nav = {
    open: (sub: Sub) => setPlace((p) => open(p, sub)),
    replace: (sub: Sub) => setPlace((p) => replace(p, sub)),
    back: () => setPlace((p) => back(p) as Place),
  };
  const sub = current(place);
  if (sub) {
    return (
      <View style={[local.root, { backgroundColor: c.page, paddingBottom: insets.bottom }]}>
        <View style={{ height: insets.top, backgroundColor: c.surface }} />
        <SubScreen key={JSON.stringify(place.subs)} sub={sub} nav={nav} />
      </View>
    );
  }

  if (place.screen !== 'tab') {
    const goBack = () => setPlace(back(place) as Place);
    return (
      <View style={[local.root, { backgroundColor: c.page, paddingBottom: insets.bottom }]}>
        <View style={{ height: insets.top, backgroundColor: c.surface }} />
        {place.screen === 'prices' ? (
          <PriceListScreen onBack={goBack} />
        ) : place.page ? (
          <SettingsPageScreen key={place.page} page={place.page} onBack={goBack} />
        ) : (
          <Settings
            onBack={goBack}
            onPriceList={() => setPlace(openPriceList(place))}
            onOpen={(page) => setPlace(openSettingsPage(place, page))}
          />
        )}
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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={local.main}>
          {tab.id === 'customers' ? <CustomersTab nav={nav} /> : <EmptyState title={tab.empty.title} body={tab.empty.body} />}
        </ScrollView>
        <NewButton onPress={() => setNewOpen(true)} />
      </View>
      <TabBar current={place.tab} onSelect={(id) => setPlace(selectTab(place, id))} bottom={insets.bottom} />
      <NewSheet
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        onCustomer={() => {
          setNewOpen(false);
          nav.open({ screen: 'customer-form' });
        }}
      />
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

function NewSheet({ visible, onClose, onCustomer }: { visible: boolean; onClose: () => void; onCustomer: () => void }) {
  const c = useColours();
  return (
    <Sheet visible={visible} title="Make something new" onClose={onClose}>
      <View style={[local.list, { borderColor: c.line }]}>
        {newChoices.map((choice, i) =>
          choice === 'Customer' ? (
            <Row key={choice} first={i === 0} title="Customer" subtitle="A person or organisation you work for" onPress={onCustomer} />
          ) : (
            <View
              key={choice}
              accessible
              style={[local.item, i > 0 && { borderTopWidth: size.hairline, borderTopColor: c.line }]}
            >
              <Text style={[local.itemTitle, { color: c.fg }]}>{choice}</Text>
              <Text style={[parts.small, { color: c.label }]}>Comes in a later test build</Text>
            </View>
          ),
        )}
      </View>
    </Sheet>
  );
}

function Settings({
  onBack,
  onPriceList,
  onOpen,
}: {
  onBack: () => void;
  onPriceList: () => void;
  onOpen: (page: SettingsPage) => void;
}) {
  const c = useColours();
  const db = useDb();
  const [itemCount] = useState(() => priceItems(db).length);
  const version = Constants.expoConfig?.version ?? '';
  const build = String(Constants.expoConfig?.extra?.build ?? '');
  const countText = itemCount === 0 ? 'No items yet' : itemCount === 1 ? '1 item' : `${itemCount} items`;
  return (
    <>
      <SubTopBar title="Settings" onBack={onBack} />
      <ScrollView contentContainerStyle={local.main}>
        <SetupSettings
          onOpen={onOpen}
          priceList={
            <Tappable
              accessibilityRole="button"
              accessibilityLabel={`Price list, ${countText}`}
              onPress={onPriceList}
              style={({ pressed }) => [local.item, local.linkItem, pressed && { backgroundColor: c.tint }]}
            >
              <View style={local.itemText}>
                <Text style={[local.itemTitle, { color: c.fg }]}>Price list</Text>
                <Text style={[parts.small, { color: c.label }]}>{countText}</Text>
              </View>
              <Icon name="next" colour={c.label} px={size.iconS} />
            </Tappable>
          }
        />
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
  section: { gap: space.s2 },
  sectionTitle: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '600' },
  list: { borderWidth: size.hairline, borderRadius: radius.r, overflow: 'hidden' },
  item: { minHeight: size.topBar, padding: space.s3, justifyContent: 'center', gap: space.s05 },
  linkItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: space.s3 },
  itemText: { flex: 1, gap: space.s05 },
  itemTitle: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
});
