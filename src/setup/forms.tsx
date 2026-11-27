import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Db } from '../db';
import { Choice, Field, FieldGroup, Toggle } from '../ui/fields';
import { Button, Tappable, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { lineHeight, radius, size, space, type } from '../ui/tokens';
import { BRAND_COLOURS, PAPER, parseColour, textColourFor } from './colour';
import { dateFromParts, longDate, MONTHS, todayAt, type PlainDate } from './dates';
import { fileText, fileUri, keepSignature, pickPicture } from './files';
import { PERIOD_CHOICES, periodLabel, type PeriodSetting } from './period';
import { SignaturePad } from './SignaturePad';
import {
  businessDetails,
  choosePeriod,
  DOCUMENT_TYPE_NAMES,
  documentCounters,
  emptyBusiness,
  FONTS,
  formatNumber,
  nextNumber,
  pendingPeriod,
  periodSetting,
  problemsWith,
  saveBusinessDetails,
  setStartDate,
  setStartingNumber,
  SetupError,
  startDate,
  type BusinessDetails,
  type DocumentType,
  type FontName,
} from './store';
import { stepProblems, type StepId } from './wizard';

// The setup forms. The wizard shows them one step at a time; Settings shows
// the same forms on its own pages. `useSetupForm` holds what the User typed and
// saves a step when they move on.

export const today = (): PlainDate => todayAt(Date.now());

type Errors = Record<string, string>;
const BUSINESS_STEPS: readonly StepId[] = ['business', 'contact', 'look', 'payment', 'signature'];

function message(e: unknown): string {
  if (e instanceof SetupError) return e.message;
  throw e;
}

export function useSetupForm(db: Db) {
  const [business, setBusiness] = useState<BusinessDetails>(() => businessDetails(db) ?? emptyBusiness());
  const [numbers, setNumbers] = useState<Record<DocumentType, string>>(() => {
    const out = {} as Record<DocumentType, string>;
    for (const c of documentCounters(db)) out[c.type] = String(c.startingNumber);
    return out;
  });
  const [start, setStart] = useState(() => {
    const [y, m, d] = startDate(db).split('-');
    return { day: String(Number(d)), month: String(Number(m)), year: y! };
  });
  const [period, setPeriod] = useState<PeriodSetting>(() => pendingPeriod(db, today())?.setting ?? periodSetting(db, today()));
  const [errors, setErrors] = useState<Errors>({});

  const edit = (change: Partial<BusinessDetails>) => setBusiness((b) => ({ ...b, ...change }));

  function saveBusiness(problems: Errors): boolean {
    if (Object.keys(problems).length) {
      setErrors(problems);
      return false;
    }
    try {
      saveBusinessDetails(db, business, today());
    } catch (e) {
      setErrors({ form: message(e) });
      return false;
    }
    return true;
  }

  /** Checks and saves one step. False, with the errors shown, if something must be fixed first. */
  function commit(step: StepId | 'allBusiness'): boolean {
    setErrors({});
    if (step === 'allBusiness') return saveBusiness(problemsWith(business));
    if (BUSINESS_STEPS.includes(step)) return saveBusiness(stepProblems(step, business));
    if (step === 'numbers') {
      const found: Errors = {};
      for (const c of documentCounters(db)) {
        if (c.locked) continue;
        const text = numbers[c.type].trim();
        const n = /^\d+$/.test(text) ? Number(text) : NaN;
        try {
          if (n !== c.startingNumber) setStartingNumber(db, c.type, n);
        } catch (e) {
          found[c.type] = message(e);
        }
      }
      setErrors(found);
      return Object.keys(found).length === 0;
    }
    if (step === 'start') {
      const date = dateFromParts(start.day, start.month, start.year);
      if (!date) {
        setErrors({ start: 'Enter a real day, such as 1 11 2026 for 1 November 2026.' });
        return false;
      }
      try {
        setStartDate(db, date, today());
      } catch (e) {
        setErrors({ start: message(e) });
        return false;
      }
      return true;
    }
    if (step === 'period') {
      try {
        choosePeriod(db, period, today());
      } catch (e) {
        setErrors({ period: message(e) });
        return false;
      }
      return true;
    }
    return true;
  }

  return { db, business, edit, numbers, setNumbers, start, setStart, period, setPeriod, errors, setErrors, commit };
}

export type SetupForm = ReturnType<typeof useSetupForm>;

/** Plain words under a step's question. */
export function Lead({ children }: { children: string }) {
  const c = useColours();
  return <Text style={[parts.body, { color: c.label }]}>{children}</Text>;
}

/** A problem that is not about one field, read out when it appears. */
export function FormError({ text }: { text?: string }) {
  const c = useColours();
  return (
    <Text accessibilityLiveRegion="polite" style={[local.error, { color: c.bad }]}>
      {text ? `! ${text}` : ''}
    </Text>
  );
}

// --- Business details ---

export function NameForm({ form, autoFocus }: { form: SetupForm; autoFocus?: boolean }) {
  const { business: b, edit, errors } = form;
  return (
    <>
      <Field
        label="Business name"
        value={b.name}
        onChangeText={(name) => edit({ name })}
        error={errors.name}
        autoFocus={autoFocus}
        autoCapitalize="words"
      />
      <Field
        label="Trading as (optional)"
        hint="A short line above your name, if you trade under another name."
        value={b.tradingAs}
        onChangeText={(tradingAs) => edit({ tradingAs })}
      />
      <Field
        label="What you do"
        hint="One line at the foot of your Documents, such as Plumbing, tiling and building."
        value={b.whatWeDo}
        onChangeText={(whatWeDo) => edit({ whatWeDo })}
      />
      <LogoPicker form={form} />
    </>
  );
}

function LogoPicker({ form }: { form: SetupForm }) {
  const c = useColours();
  const { db, business: b, edit, errors, setErrors } = form;
  const uri = b.logoFileId ? fileUri(db, b.logoFileId) : null;
  async function choose() {
    try {
      const id = await pickPicture(db, 'logo');
      if (id) edit({ logoFileId: id });
    } catch (e) {
      setErrors({ logo: e instanceof SetupError ? e.message : 'Mhizha could not read that picture. Try another one.' });
    }
  }
  return (
    <View style={local.field}>
      <Text style={[local.label, { color: c.fg }]}>Logo (optional)</Text>
      <View style={local.row}>
        <View style={[local.logo, { borderColor: c.line, backgroundColor: c.surface }]}>
          {uri ? (
            <Image source={{ uri }} style={local.logoImage} resizeMode="contain" accessibilityLabel="Your logo" />
          ) : (
            <Text style={[parts.small, { color: c.label }]}>No logo</Text>
          )}
        </View>
        <View style={local.rowActions}>
          <Button label={uri ? 'Change logo' : 'Choose logo'} onPress={choose} />
          {uri ? <Button label="Remove logo" onPress={() => edit({ logoFileId: null, watermark: false })} /> : null}
        </View>
      </View>
      <FormError text={errors.logo} />
    </View>
  );
}

export function ContactForm({ form }: { form: SetupForm }) {
  const { business: b, edit, errors } = form;
  const phone = (i: number) => b.phones[i] ?? '';
  const setPhone = (i: number, text: string) => {
    const phones = [phone(0), phone(1)];
    phones[i] = text;
    edit({ phones });
  };
  const address = (change: Partial<BusinessDetails['address']>) => edit({ address: { ...b.address, ...change } });
  return (
    <>
      <FieldGroup>
        <Field label="Phone" value={phone(0)} onChangeText={(t) => setPhone(0, t)} keyboardType="phone-pad" />
        <Field label="Second phone (optional)" value={phone(1)} onChangeText={(t) => setPhone(1, t)} keyboardType="phone-pad" />
        <Field
          label="Email (optional)"
          value={b.email}
          onChangeText={(email) => edit({ email })}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </FieldGroup>
      <FieldGroup title="Address">
        <Field label="Street address" value={b.address.line1} onChangeText={(line1) => address({ line1 })} />
        <Field label="Address line 2 (optional)" value={b.address.line2} onChangeText={(line2) => address({ line2 })} />
        <Field label="Suburb" value={b.address.suburb} onChangeText={(suburb) => address({ suburb })} />
        <Field label="City or town" value={b.address.city} onChangeText={(city) => address({ city })} />
        <Field label="Province" value={b.address.province} onChangeText={(province) => address({ province })} />
        <Field label="Country" value={b.address.country} onChangeText={(country) => address({ country })} />
      </FieldGroup>
      <Field
        label="Tax number (optional)"
        hint="Printed on your Documents if you have one."
        value={b.taxNumber}
        onChangeText={(taxNumber) => edit({ taxNumber })}
        autoCapitalize="characters"
      />
    </>
  );
}

export function LookForm({ form }: { form: SetupForm }) {
  const c = useColours();
  const { business: b, edit, errors } = form;
  const premade = BRAND_COLOURS.find((x) => x.hex === parseColour(b.brandColour));
  const [own, setOwn] = useState(premade ? '' : b.brandColour);
  const colour = parseColour(b.brandColour);
  const textColour = colour ? textColourFor(colour) : null;
  return (
    <>
      <View style={local.field} accessibilityRole="radiogroup" accessibilityLabel="Brand colour">
        <Text style={[local.label, { color: c.fg }]}>Brand colour</Text>
        <Text style={[parts.small, { color: c.label }]}>Used for lines and headings on your Documents.</Text>
        <View style={local.swatches}>
          {BRAND_COLOURS.map((x) => {
            const on = premade?.hex === x.hex;
            return (
              <Tappable
                key={x.hex}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={x.name}
                onPress={() => {
                  setOwn('');
                  edit({ brandColour: x.hex });
                }}
                style={[local.swatchTarget, on && { borderColor: c.fg }]}
              >
                <View style={[local.swatch, { backgroundColor: x.hex, borderColor: c.input }]} />
              </Tappable>
            );
          })}
        </View>
        <Text style={[parts.small, { color: c.label }]}>{premade ? `Chosen: ${premade.name}` : 'Chosen: your own colour'}</Text>
      </View>
      <Field
        label="Or your own colour (optional)"
        hint="Its code, such as #0F766E."
        value={own}
        onChangeText={(t) => {
          setOwn(t);
          edit({ brandColour: t.trim() ? t : (premade?.hex ?? BRAND_COLOURS[0]!.hex) });
        }}
        error={errors.brandColour}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {colour && textColour && textColour !== colour ? (
        <Text style={[parts.small, { color: c.label }]}>
          {`This colour is too pale for small text, so small text on your Documents uses a darker shade, ${textColour}.`}
        </Text>
      ) : null}
      <Choice<FontName>
        label="Font on your Documents"
        options={FONTS.map((f) => ({ value: f, label: f === 'Inter' ? 'Inter (usual)' : f }))}
        value={b.font}
        onChange={(font) => edit({ font })}
      />
      {b.logoFileId ? (
        <Toggle
          label="Faint logo behind the page"
          hint="A large, very light copy of your logo on each Document."
          value={b.watermark}
          onChange={(watermark) => edit({ watermark })}
        />
      ) : null}
    </>
  );
}

export function PaymentForm({ form }: { form: SetupForm }) {
  const { business: b, edit } = form;
  return (
    <>
      <FieldGroup title="Bank">
        <Field label="Bank (optional)" value={b.bankName} onChangeText={(bankName) => edit({ bankName })} />
        <Field label="Account name" value={b.accountName} onChangeText={(accountName) => edit({ accountName })} />
        <Field
          label="Account number"
          value={b.accountNumber}
          onChangeText={(accountNumber) => edit({ accountNumber })}
          keyboardType="number-pad"
        />
        <Field label="Branch" value={b.branch} onChangeText={(branch) => edit({ branch })} />
      </FieldGroup>
      <Field
        label="Mobile money (optional)"
        hint="The service and number, such as EcoCash 077 123 4567."
        value={b.mobileMoney}
        onChangeText={(mobileMoney) => edit({ mobileMoney })}
      />
    </>
  );
}

export function SignatureForm({ form }: { form: SetupForm }) {
  const c = useColours();
  const { db, business: b, edit, errors, setErrors } = form;
  const [drawing, setDrawing] = useState(!b.signatureFileId);
  const svg = b.signatureFileId ? fileText(db, b.signatureFileId) : null;
  if (!drawing && svg) {
    return (
      <View style={local.field}>
        <Text style={[local.label, { color: c.fg }]}>Your signature</Text>
        <View style={[local.signature, { borderColor: c.line, backgroundColor: PAPER }]}>
          <SvgXml xml={svg} width="100%" height="100%" accessibilityLabel="Your signature" />
        </View>
        <View style={local.rowActions}>
          <Button label="Draw again" onPress={() => setDrawing(true)} />
          <Button label="Remove signature" onPress={() => edit({ signatureFileId: null })} />
        </View>
      </View>
    );
  }
  return (
    <>
      <SignaturePad
        onKeep={async (text) => {
          try {
            edit({ signatureFileId: await keepSignature(db, text) });
            setDrawing(false);
          } catch {
            setErrors({ signature: 'Mhizha could not keep the signature. Try again.' });
          }
        }}
      />
      <FormError text={errors.signature} />
    </>
  );
}

// --- Document numbers, Start date, Accounting period ---

export function NumbersForm({ form }: { form: SetupForm }) {
  const c = useColours();
  const { db, numbers, setNumbers, errors } = form;
  return (
    <>
      {documentCounters(db).map((counter) => {
        const name = DOCUMENT_TYPE_NAMES[counter.type];
        if (counter.locked)
          return (
            <View key={counter.type} accessible style={local.field}>
              <Text style={[local.label, { color: c.fg }]}>{`First ${name.slice(0, -1)} number`}</Text>
              <Text style={[parts.body, { color: c.fg }]}>{formatNumber(counter.prefix, counter.startingNumber)}</Text>
              <Text style={[parts.small, { color: c.label }]}>
                {`Locked: ${name} have been Issued. Next is ${nextNumber(counter)}.`}
              </Text>
            </View>
          );
        const text = numbers[counter.type];
        const n = /^\d+$/.test(text.trim()) ? Number(text) : null;
        return (
          <Field
            key={counter.type}
            label={`First ${name.slice(0, -1)} number`}
            hint={n ? `Printed as ${formatNumber(counter.prefix, n)}` : undefined}
            value={text}
            onChangeText={(t) => setNumbers((x) => ({ ...x, [counter.type]: t }))}
            error={errors[counter.type]}
            keyboardType="number-pad"
          />
        );
      })}
    </>
  );
}

export function StartForm({ form }: { form: SetupForm }) {
  const c = useColours();
  const { start, setStart, errors } = form;
  const date = dateFromParts(start.day, start.month, start.year);
  return (
    <>
      <View style={local.dateRow}>
        <View style={local.dateDay}>
          <Field label="Day" value={start.day} onChangeText={(day) => setStart((s) => ({ ...s, day }))} keyboardType="number-pad" />
        </View>
        <View style={local.dateDay}>
          <Field label="Month" value={start.month} onChangeText={(month) => setStart((s) => ({ ...s, month }))} keyboardType="number-pad" />
        </View>
        <View style={local.dateYear}>
          <Field label="Year" value={start.year} onChangeText={(year) => setStart((s) => ({ ...s, year }))} keyboardType="number-pad" />
        </View>
      </View>
      <Text style={[parts.body, { color: c.fg }]}>{date ? longDate(date) : ' '}</Text>
      <FormError text={errors.start} />
    </>
  );
}

export function PeriodForm({ form, afterSetup }: { form: SetupForm; afterSetup?: boolean }) {
  const c = useColours();
  const { db, period, setPeriod, errors } = form;
  const pending = afterSetup ? pendingPeriod(db, today()) : null;
  return (
    <>
      <Choice<PeriodSetting['every']>
        label="Review"
        options={PERIOD_CHOICES.map((p) => ({ value: p.every, label: p.label }))}
        value={period.every}
        onChange={(every) => setPeriod((p) => ({ ...p, every }))}
      />
      <Choice<number>
        label="Your year starts in"
        options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
        value={period.yearStarts}
        onChange={(yearStarts) => setPeriod((p) => ({ ...p, yearStarts }))}
      />
      <Text style={[parts.small, { color: c.label }]}>
        {afterSetup ? 'Most people keep January. A change starts from the next period.' : 'Most people keep January.'}
      </Text>
      {afterSetup ? (
        <Text style={[parts.small, { color: c.label }]}>
          {pending
            ? `Now: ${periodLabel(periodSetting(db, today()))}. From ${longDate(pending.from)}: ${periodLabel(pending.setting)}.`
            : `Now: ${periodLabel(periodSetting(db, today()))}.`}
        </Text>
      ) : null}
      <FormError text={errors.period} />
    </>
  );
}

const local = StyleSheet.create({
  field: { gap: space.s2 },
  label: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  error: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  rowActions: { flex: 1, gap: space.s2 },
  logo: {
    width: size.logo,
    height: size.logo,
    borderWidth: size.hairline,
    borderRadius: radius.r,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: size.logo, height: size.logo },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  swatchTarget: {
    width: size.touch + space.s1,
    height: size.touch + space.s1,
    borderRadius: radius.pill,
    borderWidth: size.ring - 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: size.touch - space.s2, height: size.touch - space.s2, borderRadius: radius.pill, borderWidth: size.hairline },
  signature: { height: size.signatureH, borderWidth: size.hairline, borderRadius: radius.r, padding: space.s2 },
  dateRow: { flexDirection: 'row', gap: space.s2 },
  dateDay: { flex: 1 },
  dateYear: { flex: 1.5 },
});
