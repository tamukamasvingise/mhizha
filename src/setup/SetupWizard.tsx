import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDb } from '../shell/Records';
import { Button, TopBar, TopBarTitle, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { lineHeight, radius, size, space, type } from '../ui/tokens';
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
  useSetupForm,
  type SetupForm,
} from './forms';
import { phoneHasLock, unlockWithPhone } from './lock';
import { finishSetup, setAppLock, SetupError } from './store';
import { wizardSteps, type StepId } from './wizard';

// The setup wizard: one question per screen, Back and Next at the foot.

const LEADS: Record<StepId, string> = {
  business: 'These go on every Quotation, Invoice and Receipt.',
  contact: 'Printed under your name on your Documents. Fill in what you use.',
  look: 'Your colour and font for your Documents. Mhizha itself stays the same.',
  payment: 'Printed on your Invoices so customers know where to pay. Leave empty what you do not use.',
  signature: 'Optional. Draw it once and it goes on your Documents. You can skip this.',
  numbers:
    'If you already number your Documents, carry on from your last numbers. A number locks once you issue the first Document of that kind.',
  start:
    'The day you start keeping your records in Mhizha. Today, or an earlier day. What customers owed you on this day are your opening balances.',
  period: 'Mhizha asks you to look over your records at the end of each period.',
  lock: "So someone holding your phone cannot open your customers and money. Mhizha uses your phone's own lock: fingerprint, face, PIN, pattern or password. You can change this in Settings.",
};

function StepBody({ id, form }: { id: StepId; form: SetupForm }): ReactNode {
  switch (id) {
    case 'business':
      return <NameForm form={form} autoFocus={!form.business.name} />;
    case 'contact':
      return <ContactForm form={form} />;
    case 'look':
      return <LookForm form={form} />;
    case 'payment':
      return <PaymentForm form={form} />;
    case 'signature':
      return <SignatureForm form={form} />;
    case 'numbers':
      return <NumbersForm form={form} />;
    case 'start':
      return <StartForm form={form} />;
    case 'period':
      return <PeriodForm form={form} />;
    case 'lock':
      return null;
  }
}

export function SetupWizard({ onDone }: { onDone: () => void }) {
  const c = useColours();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const form = useSetupForm(db);
  const [hasLock, setHasLock] = useState<boolean | null>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    phoneHasLock().then(setHasLock);
  }, []);

  const steps = wizardSteps(hasLock ?? false);
  const step = steps[Math.min(n, steps.length - 1)]!;
  const last = n === steps.length - 1;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (n === 0) return false;
      setN(n - 1);
      return true;
    });
    return () => sub.remove();
  }, [n]);

  function finish(lock: boolean) {
    try {
      if (hasLock) setAppLock(db, lock);
      finishSetup(db);
      onDone();
    } catch (e) {
      if (!(e instanceof SetupError)) throw e;
      form.setErrors({ form: e.message });
    }
  }

  function next() {
    if (!form.commit(step.id)) return;
    if (last) finish(false);
    else setN(n + 1);
  }

  async function lockYes() {
    if (await unlockWithPhone()) finish(true);
    else form.setErrors({ form: "Your phone's lock was not confirmed, so Mhizha is not locked. Try again, or tap Not now." });
  }

  return (
    <View style={[local.root, { backgroundColor: c.page, paddingBottom: insets.bottom }]}>
      <View style={{ height: insets.top, backgroundColor: c.surface }} />
      <TopBar>
        <TopBarTitle>Set up Mhizha</TopBarTitle>
      </TopBar>
      <KeyboardAvoidingView behavior="padding" style={local.root}>
        <ScrollView key={step.id} keyboardShouldPersistTaps="handled" contentContainerStyle={local.main}>
          <View
            style={local.steps}
            accessible
            accessibilityLabel={`Step ${n + 1} of ${steps.length}`}
          >
            {steps.map((s, i) => (
              <View key={s.id} style={[local.segment, { backgroundColor: i <= n ? c.brand : c.line }]} />
            ))}
          </View>
          <Text style={[parts.small, { color: c.label }]} importantForAccessibility="no">
            {`Step ${n + 1} of ${steps.length}`}
          </Text>
          <Text accessibilityRole="header" style={[local.question, { color: c.fg }]}>
            {step.question}
          </Text>
          <Lead>{LEADS[step.id]}</Lead>
          <StepBody key={step.id} id={step.id} form={form} />
          {step.id === 'lock' ? (
            <View style={local.lockActions}>
              <Button primary label="Yes, lock Mhizha" onPress={lockYes} />
              <Button label="Not now" onPress={() => finish(false)} />
            </View>
          ) : null}
          <FormError text={form.errors.form} />
        </ScrollView>
        {step.id !== 'lock' || n > 0 ? (
          <View style={[local.foot, { backgroundColor: c.surface, borderTopColor: c.line }]}>
            {n > 0 ? (
              <View style={local.grow}>
                <Button label="Back" onPress={() => setN(n - 1)} />
              </View>
            ) : null}
            {step.id !== 'lock' ? (
              <View style={local.grow}>
                <Button primary label={last ? 'Finish' : 'Next'} onPress={next} />
              </View>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const local = StyleSheet.create({
  root: { flex: 1 },
  main: { padding: space.s4, gap: space.s4 },
  steps: { flexDirection: 'row', gap: space.s1 },
  segment: { flex: 1, height: size.stepBar, borderRadius: radius.r },
  question: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  lockActions: { gap: space.s2 },
  foot: { flexDirection: 'row', gap: space.s2, padding: space.s4, borderTopWidth: size.hairline },
  grow: { flex: 1 },
});
