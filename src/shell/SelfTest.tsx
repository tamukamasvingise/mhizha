import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runDbSelfTest, type SelfTestResult } from '../db/selfTest';
import { printHtml } from '../pdf/files';
import { invoiceHtml } from '../pdf/invoice';
import { pdfFacts, sampleInvoice } from '../pdf/selfTest';
import { styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { space } from '../ui/tokens';

// Test builds only, opened by the emulator job through a link: runs the
// database checks on the real expo-sqlite and shows the result; another runs
// the PDF checks on the real expo-print.

export function SelfTest() {
  const c = useColours();
  const insets = useSafeAreaInsets();
  const [result] = useState<SelfTestResult>(() => {
    const r = runDbSelfTest();
    console.log('MHIZHA_DB_CHECKS ' + JSON.stringify(r));
    return r;
  });
  return (
    <View style={[local.root, { backgroundColor: c.page, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={local.main}>
        <Text accessibilityRole="header" style={[parts.emptyTitle, { color: c.fg, textAlign: 'left' }]}>
          {`Database checks: ${result.passed} passed, ${result.failed.length} failed`}
        </Text>
        {result.failed.map((f) => (
          <Text key={f.name} style={[parts.body, { color: c.bad }]}>
            {`! ${f.name}: ${f.error}`}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  root: { flex: 1 },
  main: { padding: space.s4, gap: space.s3 },
});

type PdfCheck = { name: string; ok: boolean; detail: string };

async function runPdfChecks(): Promise<PdfCheck[]> {
  const out: PdfCheck[] = [];
  for (const [font, n] of [['Inter', 40], ['Source Serif 4', 5]] as const) {
    const name = `${font}, ${n} lines`;
    try {
      const { html, pages } = invoiceHtml(sampleInvoice(n, font), { logo: null, signature: null, fonts: true });
      const file = new File(await printHtml(html));
      const bytes = await file.bytes();
      file.delete();
      let text = '';
      for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const facts = pdfFacts(text);
      const family = font.replace(/ /g, '');
      const ok =
        text.startsWith('%PDF') &&
        facts.pages === pages &&
        facts.sizes.length === pages &&
        facts.sizes.every((s) => s === '595x842') &&
        // Newer WebViews may pack the font records into compressed streams,
        // where they cannot be read here; then only page count and size are checked.
        (facts.fonts.length === 0 || facts.fonts.some((f) => f.startsWith(family)));
      const fonts = facts.fonts.length ? facts.fonts.join(' ') : 'packed, not readable here';
      out.push({ name, ok, detail: `planned ${pages} pages, got ${facts.pages}; sizes ${facts.sizes.join(' ')}; fonts ${fonts}` });
    } catch (e) {
      out.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** Test builds only: prints made-up Invoices through the real expo-print and reads the PDFs back. */
export function PdfSelfTest() {
  const c = useColours();
  const insets = useSafeAreaInsets();
  const [checks, setChecks] = useState<PdfCheck[] | null>(null);
  useEffect(() => {
    runPdfChecks().then((r) => {
      console.log('MHIZHA_PDF_CHECKS ' + JSON.stringify(r));
      setChecks(r);
    });
  }, []);
  const failed = checks?.filter((x) => !x.ok).length ?? 0;
  return (
    <View style={[local.root, { backgroundColor: c.page, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={local.main}>
        <Text accessibilityRole="header" style={[parts.emptyTitle, { color: c.fg, textAlign: 'left' }]}>
          {checks ? `PDF checks: ${checks.length - failed} passed, ${failed} failed` : 'Making the test PDFs…'}
        </Text>
        {(checks ?? []).map((x) => (
          <Text key={x.name} style={[parts.body, { color: x.ok ? c.fg : c.bad }]}>
            {`${x.ok ? '✓' : '!'} ${x.name}: ${x.detail}`}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
