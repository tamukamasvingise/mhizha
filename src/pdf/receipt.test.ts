import { describe, expect, it } from 'vitest';
import { emptyBusiness } from '../setup/store';
import { receiptHtml, type ReceiptPrint } from './receipt';

// The Receipt PDF is checked through the page it is made from.

const receipt: ReceiptPrint = {
  number: 'REC-0001',
  issueDate: '2026-11-27',
  dateReceived: '2026-11-25',
  business: { ...emptyBusiness(), name: 'Demo Building Services', whatWeDo: 'Electrical installations' },
  customer: { name: 'Harare Gardens Lodge', address: '1 Example Drive, Harare', phones: ['077 123 4567'] },
  sumInWords: 'One hundred and twenty US dollars only',
  method: 'bank-transfer',
  otherDescription: '',
  amount: 12_000,
  beingPaymentFor: 'INV-0001 and INV-0002',
  lines: [
    { appliedTo: 'INV-0001', jobTitle: 'Staff cottages rewiring', total: 10_000, amount: 10_000, balanceLeft: 0 },
    { appliedTo: 'INV-0002', jobTitle: 'Borehole pump', total: 5_000, amount: 2_000, balanceLeft: 3_000 },
  ],
};

const noAssets = { logo: null, signature: null, fonts: false };

function pageTexts(html: string): string[] {
  return html
    .split('<section class="page')
    .slice(1)
    .map((p) => p.replace(/^[^>]*>/, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
}

describe('the Receipt page', () => {
  it('prints who paid, the sum in words, the method, the amount and what it paid', () => {
    const { html, pages } = receiptHtml(receipt, noAssets);
    expect(pages).toBe(1);
    const [text] = pageTexts(html);
    expect(text).toContain('Demo Building Services');
    expect(text).toContain('RECEIPT');
    expect(text).toContain('Receipt No. REC-0001 Date 27 Nov 2026 Date received 25 Nov 2026');
    expect(text).toContain('Received from Harare Gardens Lodge');
    expect(text).toContain('Address / Phone 1 Example Drive, Harare · 077 123 4567');
    expect(text).toContain('The sum of One hundred and twenty US dollars only');
    expect(text).toContain('Being payment for INV-0001 and INV-0002');
    expect(text).toContain('Payment method Cash ✓ Bank transfer Card (swipe) EcoCash InnBucks Other');
    expect(text).toContain('USD 120.00');
    expect(text).toContain('Applied to Job Total (USD) Paid now (USD) Balance left (USD)');
    expect(text).toContain('INV-0001 Staff cottages rewiring 100.00 100.00 0.00');
    expect(text).toContain('INV-0002 Borehole pump 50.00 20.00 30.00');
    expect(text).toContain('Received by');
    expect(text).toContain('RECEIPT REC-0001 Page 1 of 1');
  });

  it('shows the Date received only when it differs from the Receipt date', () => {
    const [text] = pageTexts(receiptHtml({ ...receipt, dateReceived: '2026-11-27' }, noAssets).html);
    expect(text).not.toContain('Date received');
  });

  it('ticks Other and says how they paid', () => {
    const [text] = pageTexts(receiptHtml({ ...receipt, method: 'other', otherDescription: 'Cheque' }, noAssets).html);
    expect(text).toContain('InnBucks ✓ Other: Cheque');
  });

  it('continues a long Receipt on more pages, with the signature after the last line only', () => {
    const lines = Array.from({ length: 70 }, (_, i) => ({
      appliedTo: `INV-${String(i + 1).padStart(4, '0')}`,
      jobTitle: 'Work',
      total: 1_000,
      amount: 1_000,
      balanceLeft: 0,
    }));
    const { html, pages } = receiptHtml({ ...receipt, lines, amount: 70_000 }, noAssets);
    expect(pages).toBeGreaterThan(1);
    const texts = pageTexts(html);
    expect(texts).toHaveLength(pages);
    texts.forEach((t, i) => expect(t).toContain(`RECEIPT REC-0001 Page ${i + 1} of ${pages}`));
    expect(texts[1]).toContain('RECEIPT REC-0001 · continued');
    expect(texts.slice(0, -1).some((t) => t.includes('Received by'))).toBe(false);
    expect(texts.at(-1)).toContain('Received by');
    expect(texts.join(' ').match(/INV-\d{4} Work/g)).toHaveLength(70);
  });
});
