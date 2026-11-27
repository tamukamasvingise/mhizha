// The Receipt as an A4 page (spec section 10), made like the Invoice page
// (invoice.ts): the same letterhead, footer and look, laid out and paginated
// here. "Received from", the sum in words, the Payment method tick boxes, a
// large USD amount box, then a table of what was paid and the balance left.
// A "Deposit applied" Receipt has a subtitle and a notice that no new money
// was received, naming the original Receipt; it has no Payment method. A
// Refund is laid out the same way: Paid to, what it refunds, the reason and
// the method ticked under "Paid by", with no table.
import { PAYMENT_METHOD_NAMES, PAYMENT_METHODS, type Cents, type PaymentMethod } from '../core';
import { shortDate } from '../dates';
import type { RefundPrint } from '../payments/refunds';
import type { BusinessDetails } from '../setup/store';
import { css, esc, footer, LAYOUT, letterhead, signature, style, usd, type Block, type PrintAssets } from './invoice';
import { lineCount } from './measure';

/** What a Receipt prints, from its frozen copy. */
export type ReceiptPrint = {
  number: string;
  issueDate: string;
  dateReceived: string;
  business: BusinessDetails;
  customer: { name: string; address: string; phones: readonly string[] };
  sumInWords: string;
  /** How they paid; null when no money was received. */
  method: PaymentMethod | null;
  /** How they paid, when the method is Other. */
  otherDescription: string;
  amount: Cents;
  /** "INV-0001 and INV-0002". */
  beingPaymentFor: string;
  lines: readonly { appliedTo: string; jobTitle: string; total: Cents; amount: Cents; balanceLeft: Cents }[];
  /** For a Receipt with no new money: its subtitle ("Deposit applied") and the notice naming where the money came from. */
  applied?: { title: string; notice: string } | null;
  /** For a Refund: what it pays back and from where, and why. The page then reads as a Refund, with no table. */
  refund?: { refundOf: string; reason: string } | null;
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
const SUB_H = 14;
const NOTICE_PAD = 7;
const NOTICE_LH = 12.5;
const NOTICE_GAP = 14;

const word = (p: ReceiptPrint) => (p.refund ? 'REFUND' : 'RECEIPT');
const label = (p: ReceiptPrint) => `${word(p)} ${p.number}`;

function titleBlock(p: ReceiptPrint): Block {
  const meta: [string, string][] = [
    [p.refund ? 'Refund No.' : 'Receipt No.', p.number],
    ['Date', shortDate(p.issueDate)],
  ];
  if (p.dateReceived !== p.issueDate) meta.push([p.refund ? 'Date paid' : 'Date received', shortDate(p.dateReceived)]);
  const sub = p.applied?.title ?? '';
  const inner = Math.max(34 + (sub ? SUB_H : 0), meta.length * 17);
  const html =
    `<div class="title" data-h="${inner}"><h1>${word(p)}${sub ? `<small>${esc(sub)}</small>` : ''}</h1>` +
    `<table class="meta">${meta.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>`;
  return { html, height: 16 + inner + 14 };
}

/** "No new money was received …", on a Receipt with no new money only. */
function notice(p: ReceiptPrint): Block {
  if (!p.applied) return { html: '', height: 0 };
  const lines = Math.max(1, lineCount(p.applied.notice, W - 2 * CELL_X - 2 * NOTICE_PAD, style(p.business.font, 9.5)));
  const inner = lines * NOTICE_LH + 2 * NOTICE_PAD;
  return {
    html: `<div class="notice" style="height:${inner}pt">${esc(p.applied.notice)}</div>`,
    height: inner + NOTICE_GAP,
  };
}

function fields(p: ReceiptPrint): Block {
  const f = p.business.font;
  const rows = (
    [
      [p.refund ? 'Paid to' : p.applied ? 'Customer' : 'Received from', p.customer.name],
      ['Address / Phone', [p.customer.address, p.customer.phones.join(', ')].filter(Boolean).join(' · ')],
      ['The sum of', p.sumInWords],
      ...(p.refund
        ? [
            ['Refund of', p.refund.refundOf],
            ['Reason', p.refund.reason],
          ]
        : [['Being payment for', p.applied ? '' : p.beingPaymentFor]]),
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
  if (p.method === null) {
    // No new money: no Payment method, only the amount applied.
    return {
      html: `<div class="payrow" data-h="${AMOUNT_H}"><div></div><div class="amount"><b>USD</b><span>${usd(p.amount)}</span></div></div>`,
      height: 11 + AMOUNT_H + 14,
    };
  }
  const html =
    `<div class="payrow" data-h="${inner}"><div><div class="sec">${p.refund ? 'Paid by' : 'Payment method'}</div><div class="methods">${methods}</div></div>` +
    `<div class="amount"><b>USD</b><span>${usd(p.amount)}</span></div></div>`;
  return { html, height: 11 + inner + 14 };
}

function shortHeader(p: ReceiptPrint): Block {
  return {
    html: `<header class="lh-small" style="height:${SHORT_HEAD}pt"><b>${esc(p.business.name)}</b><span>${esc(label(p))} · continued</span></header>`,
    height: SHORT_HEAD,
  };
}

const tableTop = (p: ReceiptPrint) =>
  `<table class="lines paid"><thead><tr style="height:${TABLE_HEAD}pt"><th class="to">Applied to</th><th>Job</th>` +
  `<th class="m">Total (USD)</th><th class="m">${p.applied ? 'Applied now' : 'Paid now'} (USD)</th><th class="m">Balance left (USD)</th></tr></thead><tbody>`;

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
  const first = letterhead(p, a).height + titleBlock(p).height + notice(p).height + fields(p).height + payRow(p).height;
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
  `.lines.paid .to{width:${COL.to}pt}` +
  `.title h1 small{display:block;font-size:10pt;line-height:${SUB_H}pt;font-weight:600;color:var(--muted);letter-spacing:0}` +
  `.notice{border-left:3pt solid var(--accent);background:#f3f4f6;padding:${NOTICE_PAD}pt ${NOTICE_PAD}pt;font-size:9.5pt;line-height:${NOTICE_LH}pt;margin-bottom:${NOTICE_GAP}pt;overflow:hidden;flex-shrink:0}`;

/** The whole Receipt as one HTML page for expo-print, and how many A4 pages it has. */
export function receiptHtml(p: ReceiptPrint, a: PrintAssets): { html: string; pages: number } {
  const plan = planReceiptPages(p, a);
  const total = plan.length;
  const watermark = p.business.watermark && a.logo ? `<img class="wm" src="${a.logo}" alt="">` : '';
  const sections = plan.map((rows, i) => {
    const first = i === 0;
    const last = i === total - 1;
    let body = first
      ? letterhead(p, a).html + titleBlock(p).html + notice(p).html + fields(p).html + payRow(p).html
      : shortHeader(p).html;
    if (rows.length > 0) body += tableTop(p) + rows.map((r) => lineRow(p, r).html).join('') + '</tbody></table>';
    body += last
      ? signature(a, p.refund ? 'Paid by' : p.applied ? 'Issued by' : 'Received by').html
      : '<div class="cont">Continued on the next page</div>';
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

/** The Refund as one HTML page for expo-print: laid out as a Receipt, headed REFUND, with no table. */
export function refundHtml(p: RefundPrint, a: PrintAssets): { html: string; pages: number } {
  return receiptHtml(
    {
      number: p.number,
      issueDate: p.issueDate,
      dateReceived: p.date,
      business: p.business,
      customer: p.customer,
      sumInWords: p.sumInWords,
      method: p.method,
      otherDescription: p.otherDescription,
      amount: p.amount,
      beingPaymentFor: '',
      lines: [],
      applied: null,
      refund: { refundOf: p.refundOf, reason: p.reason },
    },
    a,
  );
}
