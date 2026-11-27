import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Mark } from '../ui/Icon';
import { CustomersTab } from '../people/screens/CustomersTab';
import { DocumentsTab, HomeTab } from '../documents/screens/Tabs';
import { SubScreen } from '../people/screens/SubScreen';
import { priceItems } from '../prices/priceList';
import { PriceListScreen } from '../prices/PriceListScreen';
import { payments } from '../payments';
import { PaymentMethodsScreen } from '../payments/screens/PaymentMethodsScreen';
import { EmptyState, IconButton, Sheet, SubTopBar, Tappable, TopBar, TopBarTitle, styles as parts } from '../ui/parts';
import { Row } from '../ui/forms';
import { useColours } from '../ui/theme';
import { elevation, lineHeight, radius, size, space, type } from '../ui/tokens';
import { SettingsPageScreen, SetupSettings } from '../setup/SettingsPages';
import { ProblemReportBody } from './ProblemReport';
import { HelpScreen } from '../help/HelpScreen';
import { UpdateBanner, UpdateSettings } from '../updates/UpdateParts';
import { useCheckFailed, useDb } from './Records';
import {
  back,
  current,
  leaveDraft,
  newChoices,
  open,
  openHelp,
  openPaymentMethods,
  openPriceList,
  openReport,
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
    leave: (draftId: string, then?: Sub) => setPlace((p) => leaveDraft(p, draftId, then)),
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
        ) : place.screen === 'methods' ? (
          <PaymentMethodsScreen onBack={goBack} />
        ) : place.screen === 'help' ? (
          <HelpScreen onBack={goBack} onReport={() => setPlace(openReport(place))} />
        ) : place.screen === 'report' ? (
          <Report onBack={goBack} />
        ) : place.page ? (
          <SettingsPageScreen key={place.page} page={place.page} onBack={goBack} />
        ) : (
          <Settings
            onBack={goBack}
            onPriceList={() => setPlace(openPriceList(place))}
            onMethods={() => setPlace(openPaymentMethods(place))}
            onOpen={(page) => setPlace(openSettingsPage(place, page))}
            onReport={() => setPlace(openReport(place))}
            onHelp={() => setPlace(openHelp(place))}
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
          <CheckBanner onPress={() => setPlace(openReport(place))} />
          {tab.id === 'home' ? <UpdateBanner /> : null}
          {tab.id === 'customers' ? (
            <CustomersTab nav={nav} />
          ) : tab.id === 'home' ? (
            <HomeTab />
          ) : tab.id === 'documents' ? (
            <DocumentsTab nav={nav} />
          ) : (
            <EmptyState title={tab.empty.title} body={tab.empty.body} />
          )}
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
        onInvoice={() => {
          setNewOpen(false);
          nav.open({ screen: 'invoice-step', step: 'who' });
        }}
        onPayment={() => {
          setNewOpen(false);
          nav.open({ screen: 'payment' });
        }}
        onQuotation={() => {
          setNewOpen(false);
          nav.open({ screen: 'invoice-step', step: 'who', type: 'QUO' });
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

function NewSheet({
  visible,
  onClose,
  onCustomer,
  onInvoice,
  onPayment,
  onQuotation,
}: {
  visible: boolean;
  onClose: () => void;
  onCustomer: () => void;
  onInvoice: () => void;
  onPayment: () => void;
  onQuotation: () => void;
}) {
  const c = useColours();
  return (
    <Sheet visible={visible} title="Make something new" onClose={onClose}>
      <View style={[local.list, { borderColor: c.line }]}>
        {newChoices.map((choice, i) =>
          choice === 'Customer' ? (
            <Row key={choice} first={i === 0} title="Customer" subtitle="A person or organisation you work for" onPress={onCustomer} />
          ) : choice === 'Payment' ? (
            <Row key={choice} first={i === 0} title="Payment" subtitle="Money a Customer paid you, with its Receipt" onPress={onPayment} />
          ) : choice === 'Quotation' ? (
            <Row key={choice} first={i === 0} title="Quotation" subtitle="Offer a price for a Job" onPress={onQuotation} />
          ) : choice === 'Invoice' ? (
            <Row key={choice} first={i === 0} title="Invoice" subtitle="Bill a Customer for a Job" onPress={onInvoice} />
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
  onMethods,
  onOpen,
  onReport,
  onHelp,
}: {
  onBack: () => void;
  onPriceList: () => void;
  onMethods: () => void;
  onOpen: (page: SettingsPage) => void;
  onReport: () => void;
  onHelp: () => void;
}) {
  const c = useColours();
  const db = useDb();
  const [itemCount] = useState(() => priceItems(db).length);
  const [methodsText] = useState(() =>
    payments(db, Date.now)
      .methods()
      .filter((m) => !m.hidden)
      .map((m) => m.name)
      .join(', '),
  );
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
            <>
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
            <Row title="Payment methods" subtitle={methodsText} onPress={onMethods} />
            </>
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
        <UpdateSettings />
        <View style={local.section}>
          <Text accessibilityRole="header" style={[local.sectionTitle, { color: c.label }]}>
            Help
          </Text>
          <View style={[local.list, { borderColor: c.line, backgroundColor: c.surface }]}>
            <Row first title="Help and guides" subtitle="How to quote, invoice, take payments, back up and restore" onPress={onHelp} />
            <Tappable
              accessibilityRole="button"
              onPress={onReport}
              style={({ pressed }) => [local.item, { borderTopWidth: size.hairline, borderTopColor: c.line }, pressed && { backgroundColor: c.tint }]}
            >
              <Text style={[local.itemTitle, { color: c.fg }]}>Send a problem report</Text>
              <Text style={[parts.small, { color: c.label }]}>
                A text file of logs and checks, with no Customer details. You see it before you share it.
              </Text>
            </Tappable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

/** The problem report, read in full before it goes to the Share menu. */
function Report({ onBack }: { onBack: () => void }) {
  const db = useDb();
  return (
    <>
      <SubTopBar title="Problem report" onBack={onBack} />
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
