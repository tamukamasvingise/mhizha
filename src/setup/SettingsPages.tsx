import { useEffect, useState, type ReactNode } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDb } from '../shell/Records';
import type { SettingsPage } from '../shell/navigation';
import { Toggle } from '../ui/fields';
import { Button, IconButton, Tappable, TopBarTitle, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { lineHeight, radius, size, space, type } from '../ui/tokens';
import { longDate } from './dates';
import { fileUri } from './files';
import {
  ContactForm,
  FormError,
  Lead,
  LookForm,
  NameForm,
  NumbersForm,
  PaymentForm,
  PeriodForm,
  SignatureForm,
  StartForm,
  today,
  useSetupForm,
  type SetupForm,
} from './forms';
import { phoneHasLock, unlockWithPhone } from './lock';
import { periodLabel } from './period';
import { appLock, businessDetails, documentCounters, nextNumber, periodSetting, setAppLock, startDate } from './store';

// Setup in Settings: the rows that open each setup page, the App lock switch,
// and the pages themselves. Everything chosen in setup can be changed here.

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useColours();
  return (
    <View style={local.section}>
      <Text accessibilityRole="header" style={[local.sectionTitle, { color: c.label }]}>
        {title}
      </Text>
      <View style={[local.list, { borderColor: c.line, backgroundColor: c.surface }]}>{children}</View>
    </View>
  );
}

function Row({ title, sub, onPress, first, lead }: { title: string; sub: string; onPress: () => void; first?: boolean; lead?: ReactNode }) {
  const c = useColours();
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={sub}
      onPress={onPress}
      style={({ pressed }) => [
        local.item,
        local.rowItem,
        !first && { borderTopWidth: size.hairline, borderTopColor: c.line },
        pressed && { backgroundColor: c.tint },
      ]}
    >
      {lead}
      <View style={local.rowText}>
        <Text style={[local.itemTitle, { color: c.fg }]}>{title}</Text>
        <Text style={[parts.small, { color: c.label }]}>{sub}</Text>
      </View>
    </Tappable>
  );
}

/** The setup rows in Settings. Re-read each time Settings is shown. */
export function SetupSettings({ onOpen }: { onOpen: (page: SettingsPage) => void }) {
  const c = useColours();
  const db = useDb();
  const b = businessDetails(db);
  const logo = b?.logoFileId ? fileUri(db, b.logoFileId) : null;
  const numbers = documentCounters(db).map(nextNumber).join(', ');
  return (
    <>
      <Section title="Your business">
        <Row
          first
          title={b?.name ?? 'Your business'}
          sub="Name, logo and details on your Documents"
          onPress={() => onOpen('business')}
          lead={
            logo ? (
              <View style={[local.logo, { borderColor: c.line }]}>
                <Image source={{ uri: logo }} style={local.logoImage} resizeMode="contain" accessibilityLabel="Your logo" />
              </View>
            ) : null
          }
        />
      </Section>
      <Section title="Documents and money">
        <Row first title="Document numbers" sub={`Next: ${numbers}`} onPress={() => onOpen('numbers')} />
        <Row title="Accounting period" sub={periodLabel(periodSetting(db, today()))} onPress={() => onOpen('period')} />
        <Row title="Start date" sub={longDate(startDate(db))} onPress={() => onOpen('start')} />
      </Section>
      <Section title="This phone">
        <AppLockSwitch />
      </Section>
    </>
  );
}

function AppLockSwitch() {
  const c = useColours();
  const db = useDb();
  const [on, setOn] = useState(() => appLock(db));
  const [hasLock, setHasLock] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    phoneHasLock().then(setHasLock);
  }, []);

  async function change(next: boolean) {
    if (next && !(await unlockWithPhone())) {
      setNote("Your phone's lock was not confirmed, so Mhizha is not locked.");
      return;
    }
    setAppLock(db, next);
    setOn(next);
    setNote(next ? 'Mhizha now asks for your phone’s lock when it opens.' : 'Mhizha no longer asks for your phone’s lock.');
  }

  return (
    <View style={local.item}>
      {hasLock === false && !on ? (
        <View accessible>
          <Text style={[local.itemTitle, { color: c.fg }]}>Lock with the phone's screen lock</Text>
          <Text style={[parts.small, { color: c.label }]}>
            Your phone has no screen lock. Set one in your phone's settings to use this.
          </Text>
        </View>
      ) : (
        <Toggle
          label="Lock with the phone's screen lock"
          hint="Fingerprint, face, PIN, pattern or password"
          value={on}
          onChange={change}
        />
      )}
      <Text accessibilityLiveRegion="polite" style={[parts.small, { color: c.label }]}>
        {note}
      </Text>
    </View>
  );
}

const TITLES: Record<SettingsPage, string> = {
  business: 'Your business',
  numbers: 'Document numbers',
  start: 'Start date',
  period: 'Accounting period',
};

const PAGE_LEADS: Record<SettingsPage, string> = {
  business: 'These go on every Quotation, Invoice and Receipt. A change shows on Documents you make from today; Documents already Issued keep what they had.',
  numbers: 'A number locks once you issue the first Document of that kind.',
  start: 'The day you started keeping your records in Mhizha.',
  period: 'Mhizha asks you to look over your records at the end of each period.',
};

function PageBody({ page, form }: { page: SettingsPage; form: SetupForm }) {
  const c = useColours();
  if (page === 'business')
    return (
      <>
        <NameForm form={form} />
        <Heading>How customers reach you</Heading>
        <ContactForm form={form} />
        <Heading>How your Documents look</Heading>
        <LookForm form={form} />
        <Heading>Payment details</Heading>
        <PaymentForm form={form} />
        <Heading>Signature</Heading>
        <SignatureForm form={form} />
        <Text style={[parts.small, { color: c.label }]}>Save to keep your changes.</Text>
      </>
    );
  if (page === 'numbers') return <NumbersForm form={form} />;
  if (page === 'start') return <StartForm form={form} />;
  return <PeriodForm form={form} afterSetup />;
}

function Heading({ children }: { children: string }) {
  const c = useColours();
  return (
    <Text accessibilityRole="header" style={[local.heading, { color: c.fg }]}>
      {children}
    </Text>
  );
}

/** One setup page opened from Settings: the same form as in setup, then Save. */
export function SettingsPageScreen({ page, onBack }: { page: SettingsPage; onBack: () => void }) {
  const c = useColours();
  const db = useDb();
  const form = useSetupForm(db);
  const [saved, setSaved] = useState(false);
  function save() {
    setSaved(false);
    if (form.commit(page === 'business' ? 'allBusiness' : page)) setSaved(true);
  }
  const problems = Object.keys(form.errors).filter((k) => k !== 'form').length;
  return (
    <>
      <View style={[parts.topBar, local.subBar, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
        <IconButton icon="back" label="Back" onPress={onBack} />
        <View style={parts.topBarTitle}>
          <TopBarTitle>{TITLES[page]}</TopBarTitle>
        </View>
      </View>
      <KeyboardAvoidingView behavior="padding" style={local.root}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={local.main}>
          <Lead>{PAGE_LEADS[page]}</Lead>
          <PageBody page={page} form={form} />
          <Button primary label="Save" onPress={save} />
          <FormError text={form.errors.form ?? (problems ? 'Fix what is marked above, then Save again.' : undefined)} />
          <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.fg }]}>
            {saved ? '✓ Saved' : ''}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const local = StyleSheet.create({
  root: { flex: 1 },
  main: { padding: space.s4, gap: space.s4 },
  subBar: { paddingLeft: space.s1 },
  section: { gap: space.s2 },
  sectionTitle: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '600' },
  list: { borderWidth: size.hairline, borderRadius: radius.r, overflow: 'hidden' },
  item: { minHeight: size.topBar, padding: space.s3, justifyContent: 'center', gap: space.s05 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  rowText: { flex: 1, gap: space.s05 },
  itemTitle: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  heading: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700', paddingTop: space.s2 },
  logo: { width: size.touch, height: size.touch, borderWidth: size.hairline, borderRadius: radius.r, overflow: 'hidden' },
  logoImage: { width: size.touch, height: size.touch },
});
