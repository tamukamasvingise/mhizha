// The Invoice and the Quotation as A4 pages (spec section 10), in plain TypeScript: the HTML
// that expo-print turns into the PDF. expo-print runs with JavaScript off, so
// the app lays out the pages itself: every block gets the height planned here,
// later pages get a short "continued" header, and every page is written out
// with its own footer and "Page n of N".
import { discountLabel, formatQuantity, formatUsd, type Cents, type Discount, type Thousandths } from '../core';
import { shortDate } from '../dates';
import type { BusinessDetails, FontName } from '../setup/store';
import { textColourFor } from '../setup/colour';
import { FONT_DATA } from './fontData';
import { lineCount, type TextStyle } from './measure';

/** What only a Quotation prints: its Revision line and its terms. Values already in words. */
export type QuotationTerms = {
  /** "Revision 2 · replaces Rev 1 of 20 Nov 2026", or '' for the first version. */
  revisionLine: string;
  /** "30 days, until 27 Dec 2026". */
  validity: string;
  validUntil: string;
  /** "150.00 USD on acceptance", or ''. */
  deposit: string;
  leadTime: string;
};

/**
 * What an Invoice or, with `quotation`, a Quotation prints. A Draft has no
 * number and prints marked DRAFT. A Quotation has Terms instead of payment
 * details, no VAT row and no due date.
 */
export type InvoicePrint = {
  number: string | null;
  issueDate: string;
  dueDate: string;
  /** The Quotation's number, when the Invoice came from one. */
  quoteRef: string;
  orderNo: string;
  business: BusinessDetails;
  customer: { name: string; address: string; phones: readonly string[]; email: string };
  site: { location: string; contact: string };
  job: string;
  lines: readonly { description: string; quantity: Thousandths; unit: string; unitPrice: Cents; amount: Cents }[];
  subtotal: Cents;
  discount: Cents;
  discountKind: Discount | null;
  total: Cents;
  sumInWords: string;
  /** On an Invoice: each Deposit applied at issue, "Deposit applied (REC-0003)", then Balance due. */
  depositsApplied?: readonly { label: string; amount: Cents }[];
  quotation?: QuotationTerms;
};

const WORD = (p: InvoicePrint) => (p.quotation ? 'QUOTATION' : 'INVOICE');
const footLabel = (p: InvoicePrint) => `${WORD(p)} ${p.number ?? 'DRAFT'}`;

/** Pictures as data: URIs (the page is loaded with no address to fetch from), and whether to embed the fonts. */
export type PrintAssets = { logo: string | null; signature: string | null; fonts: boolean };

// --- Page geometry, in points (A4 is 595 x 842; pages are 841 high so rounding never adds a blank one) ---

export const PAGE = { width: 595, height: 841 } as const;
const PAD = { top: 34, x: 42, bottom: 28 };
const W = PAGE.width - 2 * PAD.x;
const H = PAGE.height - PAD.top - PAD.bottom;
/** Room left unused on every page, in case the widths were not wide enough. */
const SLACK = 12;

const COL = { n: 23, qty: 77, money: 79 };
const CELL_X = 5.5;
const DESC_W = W - COL.n - COL.qty - 2 * COL.money - 2 * CELL_X;
const QTY_W = COL.qty - 2 * CELL_X;
const ROW_LH = 12.5;
const ROW_PAD = 4.5;
const RULE = 0.75;
const THICK = 1.5;
const TABLE_HEAD = 35;
const CONTINUED = 17;
const SHORT_HEAD = 24;
const PARTY_GAP = 28;
const PARTY_W = (W - PARTY_GAP) / 2;
const KV_LABEL = 68;
const KV_GAP = 3;
const AFTER_RIGHT = 221;
const AFTER_GAP = 28;
const AFTER_LEFT = W - AFTER_RIGHT - AFTER_GAP;
const PAY_LABEL = 85;
const TOTAL_ROW = 23;
const BIG_ROW = 26;
const SIGNATURE = 62;
const LOGO = 45;

/** The measures other Document pages (Receipt, Refund) share with this one. */
export const LAYOUT = { W, H, SLACK, ROW_LH, ROW_PAD, RULE, THICK, CELL_X, TABLE_HEAD, CONTINUED, SHORT_HEAD } as const;

export const style = (font: FontName, size: number, more: Partial<TextStyle> = {}): TextStyle => ({ font, size, ...more });

export const usd = (c: Cents) => formatUsd(c).replace('US$', '');

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const addressText = (a: BusinessDetails['address']) =>
  [a.line1, a.line2, a.suburb, a.city, a.province, a.country].map((x) => x.trim()).filter(Boolean).join(', ');

export type Kv = [string, string];
export const filled = (rows: Kv[]) => rows.filter(([, v]) => v.trim() !== '');

// --- The blocks, each with the height it is given ---

export type Block = { html: string; height: number };

export function letterhead(p: Pick<InvoicePrint, 'business'>, a: PrintAssets): Block {
  const b = p.business;
  const f = b.font;
  const ta = b.tradingAs.trim();
  const nameW = W - (a.logo ? LOGO + 11 : 0);
  const nameLines = Math.max(1, lineCount(b.name, nameW, style(f, 22)));
  const row = Math.max(a.logo ? LOGO : 0, nameLines * 26 + 4);
  const contact = [b.phones.length ? `Cell: ${b.phones.join(' · ')}` : '', addressText(b.address), b.email.trim()].filter(Boolean);
  const contactLines = lineCount(contact.join(' ◆ '), W, style(f, 9));
  const height = (ta ? 12 : 0) + 8 + row + 5 + (contactLines ? 2 + contactLines * 12 : 0) + 8 + THICK;
  const html =
    `<header class="lh" data-h="${height}">` +
    (ta ? `<div class="ta">${esc(ta)}</div>` : '') +
    `<div class="brand" data-h="${row}">${a.logo ? `<img class="logo" src="${a.logo}" alt="">` : ''}<b>${esc(b.name)}</b></div>` +
    (contactLines ? `<div class="contact">${contact.map(esc).join(' <i class="dot"></i> ')}</div>` : '') +
    `</header>`;
  return { html, height };
}

function shortHeader(p: InvoicePrint): Block {
  return {
    html: `<header class="lh-small" style="height:${SHORT_HEAD}pt"><b>${esc(p.business.name)}</b><span>${WORD(p)} ${esc(p.number ?? 'DRAFT')} · continued</span></header>`,
    height: SHORT_HEAD,
  };
}

function titleBlock(p: InvoicePrint): Block {
  const q = p.quotation;
  const meta = filled(
    q
      ? [
          ['Quotation No.', p.number ?? ''],
          ['Date', shortDate(p.issueDate)],
          ['Valid until', shortDate(q.validUntil)],
        ]
      : [
          ['Invoice No.', p.number ?? ''],
          ['Date', shortDate(p.issueDate)],
          ['Due date', shortDate(p.dueDate)],
          ['Quote ref.', p.quoteRef],
        ],
  );
  const subs = [p.number === null ? 'Draft, not issued' : '', q?.revisionLine ?? ''].filter(Boolean);
  const sub = subs.join('<br>');
  const left = 34 + subs.length * 18;
  const inner = Math.max(left, meta.length * 17);
  const html =
    `<div class="title" data-h="${inner}"><h1>${WORD(p)}${sub ? `<small>${subs.map(esc).join('<br>')}</small>` : ''}</h1>` +
    `<table class="meta">${meta.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>`;
  return { html, height: 16 + inner + 14 };
}

export function kvHeight(rows: Kv[], valueW: number, f: FontName): number {
  if (rows.length === 0) return 0;
  const lines = rows.reduce((n, [, v]) => n + Math.max(1, lineCount(v, valueW, style(f, 9.5))), 0);
  return lines * ROW_LH + (rows.length - 1) * KV_GAP;
}

export const kv = (rows: Kv[], cls = 'kv') =>
  `<div class="${cls}">${rows.map(([k, v]) => `<span>${k}</span><div>${esc(v)}</div>`).join('')}</div>`;

function parties(p: InvoicePrint): Block {
  const f = p.business.font;
  const who = filled([
    ['Name', p.customer.name],
    ['Address', p.customer.address],
    ['Phone', p.customer.phones.join(', ')],
    ['Email', p.customer.email],
  ]);
  const where = filled([
    ['Location', p.site.location],
    ['Job', p.job],
    ['Contact', p.site.contact],
    ['Order No.', p.orderNo],
  ]);
  const valueW = PARTY_W - KV_LABEL;
  const inner = 19 + Math.max(kvHeight(who, valueW, f), kvHeight(where, valueW, f));
  const html =
    `<div class="parties" data-h="${inner}">` +
    `<div><h2>${p.quotation ? 'Quotation for' : 'Bill to'}</h2>${kv(who)}</div><div><h2>${p.quotation ? 'Site / Job' : 'Job / Site'}</h2>${kv(where)}</div></div>`;
  return { html, height: inner + 14 };
}

const TABLE_TOP =
  `<table class="lines"><thead><tr style="height:${TABLE_HEAD}pt"><th class="n">#</th><th>Description</th>` +
  `<th class="q">Qty</th><th class="m">Unit price (USD)</th><th class="m">Amount (USD)</th></tr></thead><tbody>`;

function lineRow(p: InvoicePrint, i: number): Block {
  const l = p.lines[i]!;
  const f = p.business.font;
  const qty = `${formatQuantity(l.quantity)}${l.unit ? ` ${l.unit}` : ''}`;
  const lines = Math.max(1, lineCount(l.description, DESC_W, style(f, 9.5)), lineCount(qty, QTY_W, style(f, 9.5)));
  // One point more: the smaller unit text can push the line a little taller.
  const height = 2 * ROW_PAD + lines * ROW_LH + RULE + 1;
  const html =
    `<tr data-h="${height}"><td class="n">${i + 1}</td><td>${esc(l.description)}</td>` +
    `<td class="q">${esc(formatQuantity(l.quantity))}${l.unit ? ` <span class="u">${esc(l.unit)}</span>` : ''}</td>` +
    `<td class="m">${usd(l.unitPrice)}</td><td class="m">${usd(l.amount)}</td></tr>`;
  return { html, height };
}

function afterTable(p: InvoicePrint): Block {
  const b = p.business;
  const f = b.font;
  const q = p.quotation;
  const pay = filled(
    q
      ? [
          ['Validity', q.validity],
          ['Deposit', q.deposit],
          ['Lead time', q.leadTime],
        ]
      : [
          ['Bank', b.bankName],
          ['Account name', b.accountName],
          ['Account No.', b.accountNumber],
          ['Branch', b.branch],
          ['Mobile money', b.mobileMoney],
        ],
  );
  const left = pay.length ? 15 + kvHeight(pay, AFTER_LEFT - PAY_LABEL, f) : 0;
  const rows: [string, string, string?][] = [['Subtotal', `${usd(p.subtotal)} USD`]];
  if (p.discount > 0 && p.discountKind) rows.push([discountLabel(p.discountKind), `−${usd(p.discount)} USD`]);
  // Version 1 charges no VAT: an Invoice prints the row blank, never 0.00; a Quotation has none.
  if (!q) rows.push(['VAT', '', 'vat']);
  const applied = q ? [] : (p.depositsApplied ?? []);
  rows.push(['Total', `${usd(p.total)} USD`, applied.length ? undefined : 'big']);
  if (applied.length) {
    for (const x of applied) rows.push([x.label, `${usd(x.amount)} USD`]);
    const due = p.total - applied.reduce((n, x) => n + x.amount, 0);
    rows.push(['Balance due', `${usd(due)} USD`, 'big']);
  }
  const words = `Total: ${p.sumInWords}`;
  const wordLines = lineCount(words, AFTER_RIGHT, style(f, 9));
  const right = rows.reduce((n, r) => n + (r[2] === 'big' ? BIG_ROW : TOTAL_ROW), 0) + 8 + wordLines * 12;
  const inner = Math.max(left, right);
  const html =
    `<div class="after" data-h="${inner}"><div>` +
    (pay.length ? `<div class="sec">${q ? 'Terms' : 'Payment details'}</div>${kv(pay, 'kv pay')}` : '') +
    `</div><div><table class="totals">` +
    rows
      .map(([k, v, cls]) => `<tr${cls ? ` class="${cls}"` : ''} data-h="${cls === 'big' ? BIG_ROW : TOTAL_ROW}"><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join('') +
    `</table><div class="words">${esc(words)}</div></div></div>`;
  return { html, height: 14 + inner };
}

export function signature(a: PrintAssets, label = 'Authorised signature'): Block {
  return {
    html: `<div class="sig" style="height:${SIGNATURE}pt"><div>${a.signature ? `<img src="${a.signature}" alt="">` : ''}${esc(label)}</div></div>`,
    height: SIGNATURE,
  };
}

export function footer(
  p: Pick<InvoicePrint, 'business' | 'number'>,
  page: number,
  pages: number,
  label: string,
): { html: string; height: number } {
  const what = p.business.whatWeDo.trim();
  const whatLines = Math.min(2, lineCount(what, W, style(p.business.font, 8.5)));
  const box = THICK + 6 + (whatLines ? whatLines * 11 + 4 : 0) + 10;
  return {
    html:
      `<footer class="foot" data-h="${box}">` +
      (whatLines ? `<div class="what" style="height:${whatLines * 11}pt">${esc(what)}</div>` : '') +
      `<div class="pg"><span>${esc(label)}</span><span>Page ${page} of ${pages}</span></div></footer>`,
    height: 11 + box,
  };
}

// --- Pagination ---

/** Which lines go on each page; the totals and signature follow the last line on the last page. */
export function planPages(p: InvoicePrint, a: PrintAssets): number[][] {
  const room = H - footer(p, 1, 1, footLabel(p)).height - SLACK;
  const firstHead = letterhead(p, a).height + titleBlock(p).height + parties(p).height;
  const laterHead = SHORT_HEAD;
  const tail = afterTable(p).height + SIGNATURE;
  const heights = p.lines.map((_, i) => lineRow(p, i).height);

  const pages: number[][] = [];
  let rows: number[] = [];
  let used = firstHead + TABLE_HEAD;
  heights.forEach((h, i) => {
    if (rows.length > 0 && used + h + CONTINUED > room) {
      pages.push(rows);
      rows = [];
      used = laterHead + TABLE_HEAD;
    }
    rows.push(i);
    used += h;
  });
  if (used + tail > room) {
    // The totals never stand alone when a line can go with them.
    const carry = rows.length > 1 ? [rows.pop()!] : [];
    pages.push(rows);
    rows = carry;
  }
  pages.push(rows);
  return pages;
}

// --- The page ---

function fontCss(font: FontName, embed: boolean): string {
  const fallback = font === 'Source Serif 4' ? 'Georgia, serif' : 'Arial, sans-serif';
  if (!embed) return `--font:${fallback}`;
  return `--font:"Doc", ${fallback}`;
}

function fontFaces(font: FontName): string {
  const files = FONT_DATA[font]!.files;
  return ([400, 600, 700] as const)
    .map((w) => `@font-face{font-family:"Doc";font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${files[w]}) format("woff2")}`)
    .join('');
}

export function css(p: Pick<InvoicePrint, 'business'>, a: PrintAssets): string {
  const accent = p.business.brandColour;
  return (
    (a.fonts ? fontFaces(p.business.font) : '') +
    `:root{--ink:#1e2433;--muted:#5b6270;--rule:#c9ccd3;--accent:${accent};--accent-text:${textColourFor(accent)};${fontCss(p.business.font, a.fonts)}}` +
    `@page{size:${PAGE.width}pt 842pt;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}` +
    `body{font-family:var(--font);color:var(--ink);font-size:10pt;line-height:13.5pt;-webkit-print-color-adjust:exact}` +
    `.page{width:${PAGE.width}pt;height:${PAGE.height}pt;padding:${PAD.top}pt ${PAD.x}pt ${PAD.bottom}pt;position:relative;overflow:hidden;display:flex;flex-direction:column;background:#fff}` +
    `.page.more{break-after:page;page-break-after:always}` +
    `.body{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;position:relative;z-index:1}` +
    `header,.title,.parties,.after,.sig,.foot,table.lines tr{overflow:hidden;flex-shrink:0}` +
    `.lh{text-align:center;padding-bottom:8pt;border-bottom:${THICK}pt solid var(--ink)}` +
    `.ta{display:flex;align-items:center;gap:11pt;height:12pt;font-size:8.5pt;line-height:12pt;letter-spacing:.25em;font-weight:700;text-transform:uppercase;white-space:nowrap}` +
    `.ta:before,.ta:after{content:"";flex:1;border-top:${RULE}pt solid var(--ink)}` +
    `.brand{display:flex;align-items:center;justify-content:center;gap:11pt;margin:8pt 0 5pt}` +
    `.brand b{font-size:22pt;line-height:26pt;font-weight:700;overflow-wrap:anywhere}.logo{height:${LOGO}pt;max-width:${LOGO * 3}pt;object-fit:contain}` +
    `.contact{font-size:9pt;line-height:12pt;margin-top:2pt;overflow-wrap:anywhere}` +
    `.dot{display:inline-block;width:4pt;height:4pt;background:var(--accent);transform:rotate(45deg);margin:0 3pt;vertical-align:1.5pt}` +
    `.lh-small{display:flex;justify-content:space-between;align-items:baseline;border-bottom:${THICK}pt solid var(--ink);padding-bottom:6pt;font-size:9pt;line-height:14pt;white-space:nowrap}` +
    `.lh-small b{font-size:11pt}` +
    `.title{display:flex;justify-content:space-between;align-items:flex-start;margin:16pt 0 14pt}` +
    `h1{margin:0;font-size:24pt;line-height:24pt;letter-spacing:.12em;font-weight:700}` +
    `h1:after{content:"";display:block;width:45pt;border-bottom:3pt solid var(--accent);margin-top:7pt}` +
    `h1 small{display:block;font-size:10pt;line-height:13pt;letter-spacing:.04em;color:var(--accent-text);margin-top:5pt;font-weight:600}` +
    `.meta{border-collapse:collapse;font-size:9.5pt;line-height:12pt}.meta tr{height:17pt}` +
    `.meta th{text-align:right;padding:2pt 11pt 2pt 0;font-weight:600;white-space:nowrap}` +
    `.meta td{min-width:119pt;border-bottom:${RULE}pt solid var(--rule);padding:2pt 0;white-space:nowrap}` +
    `.parties{display:grid;grid-template-columns:1fr 1fr;gap:${PARTY_GAP}pt;margin-bottom:14pt}` +
    `.parties h2,.sec{font-size:8.5pt;line-height:11pt;letter-spacing:.18em;color:var(--accent-text);margin:0 0 4pt;text-transform:uppercase;font-weight:700}` +
    `.parties h2{border-bottom:${RULE}pt solid var(--ink);padding-bottom:3pt}` +
    `.kv{display:grid;grid-template-columns:${KV_LABEL}pt 1fr;row-gap:${KV_GAP}pt;font-size:9.5pt;line-height:${ROW_LH}pt}` +
    `.kv span{color:var(--muted)}.kv div{overflow-wrap:anywhere}.kv.pay{grid-template-columns:${PAY_LABEL}pt 1fr}` +
    `table.lines{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.5pt;line-height:${ROW_LH}pt}` +
    `.lines thead th{font-size:8pt;line-height:10pt;letter-spacing:.12em;text-transform:uppercase;text-align:left;padding:6pt ${CELL_X}pt;border-top:${THICK}pt solid var(--ink);border-bottom:${RULE}pt solid var(--ink);vertical-align:bottom}` +
    `.lines td{padding:${ROW_PAD}pt ${CELL_X}pt;border-bottom:${RULE}pt solid var(--rule);vertical-align:top;overflow-wrap:anywhere}` +
    `.lines .n{width:${COL.n}pt;padding-left:0;padding-right:0;color:var(--muted);text-align:center}` +
    `.lines .q{width:${COL.qty}pt;text-align:right}` +
    `.lines .m{width:${COL.money}pt;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}` +
    `.lines th.m{white-space:normal}.lines .u{color:var(--muted);font-size:8.5pt}` +
    `.cont{height:${CONTINUED}pt;font-size:8.5pt;line-height:11pt;color:var(--muted);text-align:right;padding-top:6pt;flex-shrink:0}` +
    `.after{display:grid;grid-template-columns:1fr ${AFTER_RIGHT}pt;gap:${AFTER_GAP}pt;margin-top:14pt}` +
    `.totals{border-collapse:collapse;width:100%;font-size:9.5pt;line-height:${ROW_LH}pt}` +
    `.totals td{padding:${ROW_PAD}pt ${CELL_X}pt;border-bottom:${RULE}pt solid var(--rule);white-space:nowrap}` +
    `.totals td:last-child{text-align:right;font-variant-numeric:tabular-nums}` +
    `.totals tr.big td{font-weight:700;font-size:10.5pt;line-height:14pt;border-top:${THICK}pt solid var(--ink);border-bottom:${THICK}pt solid var(--ink)}` +
    `.words{font-size:9pt;line-height:12pt;margin-top:8pt;font-style:italic}` +
    `.sig{display:grid;grid-template-columns:1fr 1fr;margin-top:auto;padding-top:46pt}` +
    `.sig div{grid-column:2;border-top:${RULE}pt solid var(--ink);padding-top:3pt;font-size:8.5pt;line-height:11pt;color:var(--muted);position:relative}` +
    `.sig img{position:absolute;bottom:100%;left:6pt;height:37pt;max-width:108pt;object-fit:contain}` +
    `.foot{border-top:${THICK}pt solid var(--ink);margin-top:11pt;padding-top:6pt;text-align:center;font-size:8.5pt;line-height:11pt;position:relative;z-index:1}` +
    `.foot .what{color:var(--muted);overflow:hidden;margin-bottom:4pt}` +
    `.foot .pg{display:flex;justify-content:space-between;color:var(--muted);font-size:8pt;line-height:10pt}` +
    `.wm{position:absolute;right:-34pt;bottom:62pt;width:340pt;height:340pt;object-fit:contain;opacity:.07;z-index:0}` +
    `.stamp{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:64pt;line-height:72pt;font-weight:700;letter-spacing:.12em;color:rgba(82,82,91,.18);border:5pt solid rgba(82,82,91,.18);padding:4pt 22pt;white-space:nowrap;z-index:2}`
  );
}

/** The whole Invoice or Quotation as one HTML page for expo-print (or the Draft preview), and how many A4 pages it has. */
export function invoiceHtml(p: InvoicePrint, a: PrintAssets): { html: string; pages: number } {
  const plan = planPages(p, a);
  const total = plan.length;
  const tail = afterTable(p).html + signature(a, p.quotation ? 'Prepared by' : 'Authorised signature').html;
  const watermark = p.business.watermark && a.logo ? `<img class="wm" src="${a.logo}" alt="">` : '';
  const stamp = p.number === null ? '<div class="stamp">DRAFT</div>' : '';
  const sections = plan.map((rows, i) => {
    const first = i === 0;
    const last = i === total - 1;
    let body = first ? letterhead(p, a).html + titleBlock(p).html + parties(p).html : shortHeader(p).html;
    if (rows.length > 0 || (first && p.lines.length === 0)) body += TABLE_TOP + rows.map((r) => lineRow(p, r).html).join('') + '</tbody></table>';
    if (!last) body += '<div class="cont">Continued on the next page</div>';
    else body += tail;
    return (
      `<section class="page${last ? '' : ' more'}">${watermark}<div class="body">${body}</div>` +
      `${footer(p, i + 1, total, footLabel(p)).html}${stamp}</section>`
    );
  });
  const title = p.number ?? (p.quotation ? 'Draft Quotation' : 'Draft Invoice');
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>${css(p, a)}</style></head><body>${sections.join('')}</body></html>`;
  return { html, pages: total };
}

/**
 * The same pages for showing on the phone's screen (the Draft preview): each
 * page scaled to fit `width` pixels less `gap` each side, with `gap` between
 * pages, on the screen's own background.
 */
export function screenHtml(html: string, width: number, gap: number, background: string): string {
  const pagePx = (PAGE.width * 4) / 3;
  const zoom = Math.max(0.1, (width - 2 * gap) / pagePx);
  return html
    .replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">')
    .replace(
      '</style>',
      `html,body{background:${background}}body{padding:${gap / zoom}px 0}` +
        `.page{zoom:${zoom.toFixed(4)};margin:0 auto ${gap / zoom}px}</style>`,
    );
}
