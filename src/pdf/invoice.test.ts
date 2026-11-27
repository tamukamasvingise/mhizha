import { describe, expect, it } from 'vitest';
import { emptyBusiness } from '../setup/store';
import { invoiceHtml, screenHtml, type InvoicePrint } from './invoice';

// The Invoice PDF is checked through the page it is made from: the HTML that
// expo-print turns into the PDF, one block per A4 page.

const business = {
  ...emptyBusiness(),
  name: 'Demo Building Services',
  tradingAs: 'J. Sibanda T/A',
  whatWeDo: 'Electrical installations · Plumbing and borehole fitting',
  phones: ['077 000 0000', '078 000 0000'],
  address: { line1: '12 Example Road', line2: '', suburb: 'Waterfalls', city: 'Harare', province: '', country: 'Zimbabwe' },
  bankName: 'Example Bank',
  accountName: 'Demo Building Services',
  accountNumber: '1234 5678 90',
  branch: '',
  mobileMoney: 'EcoCash 077 000 0000',
};

const line = (description: string, quantity: number, unit: string, unitPrice: number, amount: number) => ({
  description,
  quantity,
  unit,
  unitPrice,
  amount,
});

const invoice: InvoicePrint = {
  number: 'INV-0009',
  issueDate: '2026-11-26',
  dueDate: '2026-12-10',
  quoteRef: '',
  orderNo: '',
  business,
  customer: { name: 'Tendai Moyo', address: '4 Acacia Close, Borrowdale, Harare', phones: ['+263 77 123 4567'], email: '' },
  site: { location: 'House, 4 Acacia Close, Borrowdale', contact: '' },
  job: 'Electric fence and sliding gate motor',
  lines: [
    line('Electric fence energiser, 8 joule, with battery backup', 1_000, 'each', 28_500, 28_500),
    line('Labour: installation, earthing and testing', 3_000, 'day', 13_500, 40_500),
    line('Aluminium wire, 2.5mm', 2_500, '100m roll', 4_199, 10_498),
  ],
  subtotal: 79_498,
  discount: 7_950,
  discountKind: { kind: 'percent', tenths: 100 },
  total: 71_548,
  sumInWords: 'Seven hundred and fifteen US dollars and forty-eight cents only',
};

const noAssets = { logo: null, signature: null, fonts: false };

/** The text of each page, tags taken out and spaces squeezed. */
function pageTexts(html: string): string[] {
  return html
    .split('<section class="page')
    .slice(1)
    .map((p) =>
      p
        .replace(/^[^>]*>/, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim(),
    );
}

describe('the Invoice page', () => {
  it('prints the number, dates, Customer, Job, lines and totals with the Discount', () => {
    const { html, pages } = invoiceHtml(invoice, noAssets);
    expect(pages).toBe(1);
    const [text] = pageTexts(html);
    expect(text).toContain('INVOICE');
    expect(text).toContain('Invoice No. INV-0009');
    expect(text).toContain('Date 26 Nov 2026');
    expect(text).toContain('Due date 10 Dec 2026');
    expect(text).toContain('Bill to Name Tendai Moyo');
    expect(text).toContain('Job Electric fence and sliding gate motor');
    expect(text).toContain('2 Labour: installation, earthing and testing 3 day 135.00 405.00');
    expect(text).toContain('2.5 100m roll 41.99 104.98');
    expect(text).toContain('Subtotal 794.98 USD');
    expect(text).toContain('Discount (10%) −79.50 USD');
    expect(text).toContain('Total 715.48 USD');
    expect(text).toContain('Total: Seven hundred and fifteen US dollars and forty-eight cents only');
    expect(text).toContain('Page 1 of 1');
  });

  it('prints the VAT row blank, not 0.00, and has no other VAT wording', () => {
    const { html } = invoiceHtml(invoice, noAssets);
    expect(html).toMatch(/<tr class="vat"[^>]*><td>VAT<\/td><td><\/td><\/tr>/);
    const [text] = pageTexts(html);
    expect(text).toContain('VAT Total 715.48 USD');
    expect(text!.match(/VAT/g)).toHaveLength(1);
  });

  it('leaves empty optional fields off instead of printing blank lines', () => {
    const [text] = pageTexts(invoiceHtml(invoice, noAssets).html);
    for (const label of ['Quote ref.', 'Order No.', 'Contact', 'Email', 'Branch']) expect(text).not.toContain(label);
    expect(text).toContain(
      'Payment details Bank Example Bank Account name Demo Building Services Account No. 1234 5678 90 Mobile money EcoCash 077 000 0000',
    );

    const full = invoiceHtml(
      { ...invoice, quoteRef: 'QUO-0012', orderNo: 'PO 4471', site: { ...invoice.site, contact: 'Mrs R. Moyo, 077 765 4321' } },
      noAssets,
    );
    const [all] = pageTexts(full.html);
    expect(all).toContain('Quote ref. QUO-0012');
    expect(all).toContain('Order No. PO 4471');
    expect(all).toContain('Contact Mrs R. Moyo, 077 765 4321');

    const bare = invoiceHtml(
      { ...invoice, business: { ...business, tradingAs: '', whatWeDo: '', bankName: '', accountName: '', accountNumber: '', mobileMoney: '' } },
      noAssets,
    );
    expect(bare.html).not.toContain('class="ta"');
    expect(bare.html).not.toContain('class="what"');
    expect(pageTexts(bare.html)[0]).not.toContain('Payment details');
  });

  it('prints the Discount row only when there is one, and an amount Discount without a percentage', () => {
    const none = pageTexts(invoiceHtml({ ...invoice, discount: 0, discountKind: null, total: 79_498 }, noAssets).html)[0];
    expect(none).not.toContain('Discount');
    const amount = pageTexts(
      invoiceHtml({ ...invoice, discount: 2_500, discountKind: { kind: 'amount', cents: 2_500 }, total: 76_998 }, noAssets).html,
    )[0];
    expect(amount).toContain('Discount −25.00 USD');
  });

  it('carries the letterhead: trading-as line, name, phones, address; the footer: what we do, number, page', () => {
    const [text] = pageTexts(invoiceHtml(invoice, noAssets).html);
    expect(text!.startsWith('J. Sibanda T/A Demo Building Services Cell: 077 000 0000 · 078 000 0000 12 Example Road, Waterfalls, Harare, Zimbabwe')).toBe(true);
    expect(text).toContain('Authorised signature Electrical installations · Plumbing and borehole fitting INVOICE INV-0009 Page 1 of 1');
  });

  it('escapes what the User typed', () => {
    const { html } = invoiceHtml({ ...invoice, job: 'Gate <b>& fence</b>' }, noAssets);
    expect(html).toContain('Gate &lt;b&gt;&amp; fence&lt;/b&gt;');
  });
});

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => line(`Galvanised steel fence post ${i + 1}, 2.4m, set in concrete with bracing stays`, 2_000, 'each', 1_850, 3_700));

describe('a long Invoice', () => {
  const long: InvoicePrint = { ...invoice, lines: many(60), subtotal: 222_000, discount: 0, discountKind: null, total: 222_000 };

  it('runs onto more pages, each with a short continued header and Page n of N', () => {
    const { html, pages } = invoiceHtml(long, noAssets);
    expect(pages).toBeGreaterThan(2);
    const texts = pageTexts(html);
    expect(texts).toHaveLength(pages);
    texts.forEach((t, i) => {
      expect(t).toContain(`INVOICE INV-0009 Page ${i + 1} of ${pages}`);
      if (i > 0) expect(t.startsWith('Demo Building Services INVOICE INV-0009 · continued')).toBe(true);
      if (i < pages - 1) expect(t).toContain('Continued on the next page');
    });
    expect(html.match(/class="page more"/g)).toHaveLength(pages - 1);
  });

  it('prints every line once, in order, and the totals and signature only after the last line', () => {
    const texts = pageTexts(invoiceHtml(long, noAssets).html);
    const found = [...texts.join(' ').matchAll(/fence post (\d+),/g)].map((m) => Number(m[1]));
    expect(found).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    texts.slice(0, -1).forEach((t) => {
      expect(t).not.toContain('Subtotal');
      expect(t).not.toContain('Authorised signature');
    });
    const last = texts.at(-1)!;
    expect(last).toContain('Subtotal 2,220.00 USD');
    expect(last).toMatch(/fence post 60,.*Subtotal.*Authorised signature/);
  });

  it('fits a few lines on one page', () => {
    expect(invoiceHtml({ ...long, lines: many(6) }, noAssets).pages).toBe(1);
  });

  it('keeps a line with the totals when they do not fit under the last line', () => {
    for (let n = 1; n <= 45; n++) {
      const texts = pageTexts(invoiceHtml({ ...long, lines: many(n) }, noAssets).html);
      expect(texts.at(-1)).toMatch(new RegExp(`fence post ${n},.*Subtotal`));
    }
  });
});

describe('a Draft', () => {
  const draft: InvoicePrint = { ...invoice, number: null };

  it('is marked DRAFT on every page and has no number', () => {
    const { html, pages } = invoiceHtml({ ...draft, lines: many(60) }, noAssets);
    const texts = pageTexts(html);
    expect(texts[0]).toContain('INVOICE Draft, not issued');
    expect(texts[0]).not.toContain('Invoice No.');
    expect(html.match(/<div class="stamp">DRAFT<\/div>/g)).toHaveLength(pages);
    texts.forEach((t, i) => expect(t).toContain(`INVOICE DRAFT Page ${i + 1} of ${pages}`));
    expect(html).not.toContain('INV-0009');
  });

  it('can be previewed with no lines yet', () => {
    const empty = { ...draft, lines: [], subtotal: 0, discount: 0, discountKind: null, total: 0, sumInWords: 'Zero US dollars only' };
    const { html, pages } = invoiceHtml(empty, noAssets);
    expect(pages).toBe(1);
    expect(pageTexts(html)[0]).toContain('# Description Qty Unit price (USD) Amount (USD) Payment details');
  });
});

describe('the Business look', () => {
  it('uses the brand colour, darkened for small text when too pale', () => {
    const { html } = invoiceHtml({ ...invoice, business: { ...business, brandColour: '#EAB308' } }, noAssets);
    expect(html).toContain('--accent:#EAB308');
    expect(html).not.toContain('--accent-text:#EAB308');
  });

  it('embeds the chosen font in three weights, and fetches nothing from outside', () => {
    const { html } = invoiceHtml({ ...invoice, business: { ...business, font: 'Source Serif 4' } }, { ...noAssets, fonts: true });
    expect(html.match(/@font-face\{font-family:"Doc";font-weight:(400|600|700);/g)).toHaveLength(3);
    expect(html).toContain('--font:"Doc", Georgia, serif');
    expect(html).not.toMatch(/(src|href)="?(https?:|file:)/);
  });

  it('prints the logo, the faint watermark only when chosen, and the signature', () => {
    const logo = 'data:image/png;base64,AAAA';
    const signature = 'data:image/svg+xml;base64,BBBB';
    const plain = invoiceHtml(invoice, { logo, signature, fonts: false }).html;
    expect(plain).toContain(`<img class="logo" src="${logo}"`);
    expect(plain).toContain(`<img src="${signature}" alt="">Authorised signature`);
    expect(plain).not.toContain('class="wm"');
    const marked = invoiceHtml({ ...invoice, business: { ...business, watermark: true } }, { logo, signature: null, fonts: false }).html;
    expect(marked).toContain(`<img class="wm" src="${logo}"`);
  });
});

describe('the Draft preview on screen', () => {
  it('fits each page to the screen width, on the screen background', () => {
    const shown = screenHtml(invoiceHtml({ ...invoice, number: null }, noAssets).html, 360, 16, '#F6F7F7');
    expect(shown).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    // A4 is 793 CSS pixels wide; 360 less 16 each side is 328.
    expect(shown).toMatch(/\.page\{zoom:0\.413\d;/);
    expect(shown).toContain('html,body{background:#F6F7F7}');
  });
});
