// The PDF check for the emulator job (test builds only): a made-up Invoice
// long enough for several pages goes through the real expo-print, and the PDF
// that comes out is read back: page count, page size and embedded fonts.
// Plain TypeScript; the app part is in shell/SelfTest.tsx.
import { emptyBusiness, type FontName } from '../setup/store';
import type { InvoicePrint } from './invoice';

/** A made-up Invoice (no real Business or Customer) with `n` lines. */
export function sampleInvoice(n: number, font: FontName): InvoicePrint {
  const lines = Array.from({ length: n }, (_, i) => ({
    description: `Galvanised steel fence post ${i + 1}, 2.4m, set in concrete with bracing stays`,
    quantity: 2_000,
    unit: 'each',
    unitPrice: 1_850,
    amount: 3_700,
  }));
  return {
    number: 'INV-0001',
    issueDate: '2026-11-27',
    dueDate: '2026-12-11',
    quoteRef: '',
    orderNo: '',
    business: {
      ...emptyBusiness(),
      name: 'Demo Building Services',
      whatWeDo: 'Electrical installations · Plumbing',
      phones: ['077 000 0000'],
      font,
      bankName: 'Example Bank',
    },
    customer: { name: 'Test Customer', address: 'Harare', phones: [], email: '' },
    site: { location: 'Main site', contact: '' },
    job: 'Fence',
    lines,
    subtotal: 3_700 * n,
    discount: 0,
    discountKind: null,
    total: 3_700 * n,
    sumInWords: 'Test amount only',
  };
}

export type PdfFacts = { pages: number; sizes: string[]; fonts: string[] };

/** What a PDF file holds, read from its bytes as Latin-1 text. */
export function pdfFacts(pdf: string): PdfFacts {
  const pages = [...pdf.matchAll(/\/Type\s*\/Page(?![a-zA-Z])/g)].length;
  const sizes = [...pdf.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(
    (m) => `${Math.round(Number(m[1]))}x${Math.round(Number(m[2]))}`,
  );
  const fonts = [...new Set([...pdf.matchAll(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([A-Za-z0-9-]+)/g)].map((m) => m[1]!))].sort();
  return { pages, sizes, fonts };
}
