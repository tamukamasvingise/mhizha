// The Receipt as an A4 page (spec section 10), made like the Invoice page
// (invoice.ts): the same letterhead, footer and look, laid out and paginated
// here. "Received from", the sum in words, the Payment method tick boxes, a
// large USD amount box, then a table of what was paid and the balance left.
import { PAYMENT_METHOD_NAMES, PAYMENT_METHODS, type Cents, type PaymentMethod } from '../core';
import { shortDate } from '../dates';
import type { BusinessDetails } from '../setup/store';
import { css, esc, footer, LAYOUT, letterhead, signature, style, usd, type Block, type PrintAssets } from './invoice';
import { lineCount } from './measure';

/** What a money Receipt prints, from its frozen copy. */
export type ReceiptPrint = {
  number: string;
  issueDate: string;
  dateReceived: string;
  business: BusinessDetails;
  customer: { name: string; address: string; phones: readonly string[] };
  sumInWords: string;
  method: PaymentMethod;
  /** How they paid, when the method is Other. */
  otherDescription: string;
  amount: Cents;
  /** "INV-0001 and INV-0002". */
  beingPaymentFor: string;
  lines: readonly { appliedTo: string; jobTitle: string; total: Cents; amount: Cents; balanceLeft: Cents }[];
};

const { W, H, SLACK, ROW_LH, ROW_PAD, RULE, CELL_X, TABLE_HEAD, CONTINUED, SHORT_HEAD } = LAYOUT;
const FIELD_LABEL = 108;
const FIELD_LH = 13.5;
const FIELD_GAP = 7;
const AMOUNT_W = 221;
const AMOUNT_H = 40;
const PAY_GAP = 22;
const COL = { to: 96, money: 79 };
const JOB_W = W - COL.to - 3 * COL.money - 2 * CELL_X;
const TO_W = COL.to - 2 * CELL_X;
const SIGNATURE = 62;

const label = (p: ReceiptPrint) => `RECEIPT ${p.number}`;

function titleBlock(p: ReceiptPrint): Block {
  const meta: [string, string][] = [
    ['Receipt No.', p.number],
    ['Date', shortDate(p.issueDate)],
  ];
  if (p.dateReceived !== p.issueDate) meta.push(['Date received', shortDate(p.dateReceived)]);
  const inner = Math.max(34, meta.length * 17);
  const html =
    `<div class="title" data-h="${inner}"><h1>RECEIPT</h1>` +
    `<table class="meta">${meta.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>`;
  return { html, height: 16 + inner + 14 };
}

function fields(p: ReceiptPrint): Block {
  const f = p.business.font;
  const rows = (
    [
      ['Received from', p.customer.name],
      ['Address / Phone', [p.customer.address, p.customer.phones.join(', ')].filter(Boolean).join(' · ')],
      ['The sum of', p.sumInWords],
      ['Being payment for', p.beingPaymentFor],
    ] as [string, string][]
  ).filter(([, v]) => v.trim() !== '');
  const inner =
    rows.reduce((n, [, v]) => n + Math.max(1, lineCount(v, W - FIELD_LABEL, style(f, 10))) * FIELD_LH + 3, 0) +
    (rows.length - 1) * FIELD_GAP;
  const html =
    `<div class="rfields" data-h="${inner}">` +
    rows.map(([k, v]) => `<span>${k}</span><div>${esc(v)}</div>`).join('') +
    `</div>`;
  return { html, height: inner + 14 };
}

function payRow(p: ReceiptPrint): Block {
  const f = p.business.font;
  const names = PAYMENT_METHODS.map((m) =>
    m === 'other' && p.method === 'other' && p.otherDescription ? `Other: ${p.otherDescription}` : PAYMENT_METHOD_NAMES[m],
  );
  // Each method has a 10pt box and a gap before the next; count them as four characters more.
  const methodLines = Math.max(1, lineCount(names.map((n) => `${n}xxxx`).join(' '), W - AMOUNT_W - PAY_GAP, style(f, 9.5)));
  const left = 11 + 4 + methodLines * 15;
  const inner = Math.max(left, AMOUNT_H);
  const methods = PAYMENT_METHODS.map(
    (m, i) => `<span><span class="box">${m === p.method ? '✓' : ''}</span>${esc(names[i]!)}</span>`,
  ).join(' ');
  const html =
    `<div class="payrow" data-h="${inner}"><div><div class="sec">Payment method</div><div class="methods">${methods}</div></div>` +
    `<div class="amount"><b>USD</b><span>${usd(p.amount)}</span></div></div>`;
  return { html, height: 11 + inner + 14 };
}

function shortHeader(p: ReceiptPrint): Block {
  return {
    html: `<header class="lh-small" style="height:${SHORT_HEAD}pt"><b>${esc(p.business.name)}</b><span>${esc(label(p))} · continued</span></header>`,
    height: SHORT_HEAD,
  };
}

const TABLE_TOP =
  `<table class="lines paid"><thead><tr style="height:${TABLE_HEAD}pt"><th class="to">Applied to</th><th>Job</th>` +
  `<th class="m">Total (USD)</th><th class="m">Paid now (USD)</th><th class="m">Balance left (USD)</th></tr></thead><tbody>`;

function lineRow(p: ReceiptPrint, i: number): Block {
  const l = p.lines[i]!;
  const f = p.business.font;
  const lines = Math.max(1, lineCount(l.appliedTo, TO_W, style(f, 9.5)), lineCount(l.jobTitle, JOB_W, style(f, 9.5)));
  const height = 2 * ROW_PAD + lines * ROW_LH + RULE + 1;
  const html =
    `<tr data-h="${height}"><td class="to">${esc(l.appliedTo)}</td><td>${esc(l.jobTitle)}</td>` +
    `<td class="m">${usd(l.total)}</td><td class="m">${usd(l.amount)}</td><td class="m">${usd(l.balanceLeft)}</td></tr>`;
  return { html, height };
}

/** Which lines go on each page; the signature follows the last line on the last page. */
export function planReceiptPages(p: ReceiptPrint, a: PrintAssets): number[][] {
  const room = H - footer(p, 1, 1, label(p)).height - SLACK;
  const first = letterhead(p, a).height + titleBlock(p).height + fields(p).height + payRow(p).height;
  const pages: number[][] = [];
  let rows: number[] = [];
  let used = first + TABLE_HEAD;
  p.lines.forEach((_, i) => {
    const h = lineRow(p, i).height;
    if (rows.length > 0 && used + h + CONTINUED > room) {
      pages.push(rows);
      rows = [];
      used = SHORT_HEAD + TABLE_HEAD;
    }
    rows.push(i);
    used += h;
  });
  if (used + SIGNATURE > room) {
    const carry = rows.length > 1 ? [rows.pop()!] : [];
    pages.push(rows);
    rows = carry;
  }
  pages.push(rows);
  return pages;
}

const RECEIPT_CSS =
  `.rfields{display:grid;grid-template-columns:${FIELD_LABEL}pt 1fr;row-gap:${FIELD_GAP}pt;font-size:10pt;line-height:${FIELD_LH}pt;margin-bottom:14pt;overflow:hidden;flex-shrink:0}` +
  `.rfields span{font-weight:600}.rfields div{border-bottom:${RULE}pt dotted var(--muted);padding-bottom:2pt;overflow-wrap:anywhere}` +
  `.payrow{display:flex;justify-content:space-between;align-items:flex-end;gap:${PAY_GAP}pt;margin:11pt 0 14pt;overflow:hidden;flex-shrink:0}` +
  `.methods{display:flex;flex-wrap:wrap;column-gap:14pt;row-gap:3pt;font-size:9.5pt;line-height:12pt}` +
  `.box{display:inline-block;width:10pt;height:10pt;border:${RULE}pt solid var(--ink);vertical-align:-1.5pt;margin-right:4pt;text-align:center;line-height:9pt;font-size:8pt;font-weight:700}` +
  `.amount{display:flex;border:2pt solid var(--ink);width:${AMOUNT_W}pt;height:${AMOUNT_H}pt;flex-shrink:0}` +
  `.amount b{background:var(--ink);color:#fff;padding:0 11pt;font-size:11pt;display:flex;align-items:center}` +
  `.amount span{flex:1;text-align:right;padding:0 11pt;font-size:14pt;font-weight:700;font-variant-numeric:tabular-nums;display:flex;align-items:center;justify-content:flex-end}` +
  `.lines.paid .to{width:${COL.to}pt}`;

/** The whole Receipt as one HTML page for expo-print, and how many A4 pages it has. */
export function receiptHtml(p: ReceiptPrint, a: PrintAssets): { html: string; pages: number } {
  const plan = planReceiptPages(p, a);
  const total = plan.length;
  const watermark = p.business.watermark && a.logo ? `<img class="wm" src="${a.logo}" alt="">` : '';
  const sections = plan.map((rows, i) => {
    const first = i === 0;
    const last = i === total - 1;
    let body = first
      ? letterhead(p, a).html + titleBlock(p).html + fields(p).html + payRow(p).html
      : shortHeader(p).html;
    if (rows.length > 0) body += TABLE_TOP + rows.map((r) => lineRow(p, r).html).join('') + '</tbody></table>';
    body += last ? signature(a, 'Received by').html : '<div class="cont">Continued on the next page</div>';
    return (
      `<section class="page${last ? '' : ' more'}">${watermark}<div class="body">${body}</div>` +
      `${footer(p, i + 1, total, label(p)).html}</section>`
    );
  });
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(p.number)}</title>` +
    `<style>${css(p, a)}${RECEIPT_CSS}</style></head><body>${sections.join('')}</body></html>`;
  return { html, pages: total };
}
