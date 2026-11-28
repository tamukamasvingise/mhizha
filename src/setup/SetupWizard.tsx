import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDb } from '../shell/Records';
import { Button, TopBar, TopBarTitle } from '../ui/parts';
import { StepFoot, StepHead } from '../ui/steps';
import { useColours } from '../ui/theme';
import { space } from '../ui/tokens';
import {
  ContactForm,
  FormError,
  Lead,
  LookForm,
  NameForm,
  NumbersForm,
  PaymentForm,
  PeriodForm,
  SalesForm,
  SignatureForm,
  StartForm,
  useSetupForm,
  type SetupForm,
} from './forms';
import { OpeningBalancesForm } from '../opening/screens/OpeningParts';
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
  opening:
    'On your Start date, did any customer owe you money, or had you taken money from one for work not yet done? Add each one from your old records. You can skip this, and add them later from the Customer.',
  presales:
    "Optional. Your sales in each of the 12 months before your Start date. Mhizha uses them only to warn you as you near the VAT limit. Leave a month empty if you don't know.",
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
    case 'opening':
      return <OpeningBalancesForm />;
    case 'presales':
      return <SalesForm form={form} />;
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
          <StepHead n={n + 1} of={steps.length} question={step.question} />
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
        <StepFoot
          onBack={n > 0 ? () => setN(n - 1) : undefined}
          next={step.id !== 'lock' ? { label: last ? 'Finish' : 'Next', onPress: next } : undefined}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const local = StyleSheet.create({
  root: { flex: 1 },
  main: { padding: space.s4, gap: space.s4 },
  lockActions: { gap: space.s2 },
});
