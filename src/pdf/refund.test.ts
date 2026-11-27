import { describe, expect, it } from 'vitest';
import type { RefundPrint } from '../payments';
import { emptyBusiness } from '../setup/store';
import { refundHtml } from './receipt';

// The Refund PDF (spec section 10): Paid to, the sum, what it refunds and
// from which Receipt, the reason, and the method ticked under "Paid by".

const refund: RefundPrint = {
  number: 'REF-0001',
  issueDate: '2026-11-27',
  date: '2026-11-26',
  business: { ...emptyBusiness(), name: 'Demo Building Services', whatWeDo: 'Electrical installations' },
  customer: { name: 'Chipo Ndlovu', address: 'Shop, Mbare', phones: ['071 987 6543'] },
  sumInWords: 'One hundred and twenty US dollars only',
  refundOf: 'Unused Deposit on QUO-0010, paid on REC-0015 (2 Oct 2026)',
  reason: 'Job dropped by the customer before work started',
  method: 'ecocash',
  otherDescription: '',
  amount: 12_000,
};

const noAssets = { logo: null, signature: null, fonts: false };

function pageTexts(html: string): string[] {
  return html
    .split('<section class="page')
    .slice(1)
    .map((p) => p.replace(/^[^>]*>/, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
}

describe('the Refund page', () => {
  it('prints who was paid, the sum, what it refunds, the reason, the method and the amount', () => {
    const { html, pages } = refundHtml(refund, noAssets);
    expect(pages).toBe(1);
    const [text] = pageTexts(html);
    expect(text).toContain('REFUND');
    expect(text).not.toContain('RECEIPT');
    expect(text).toContain('Refund No. REF-0001 Date 27 Nov 2026 Date paid 26 Nov 2026');
    expect(text).toContain('Paid to Chipo Ndlovu');
    expect(text).toContain('Address / Phone Shop, Mbare · 071 987 6543');
    expect(text).toContain('The sum of One hundred and twenty US dollars only');
    expect(text).toContain('Refund of Unused Deposit on QUO-0010, paid on REC-0015 (2 Oct 2026)');
    expect(text).toContain('Reason Job dropped by the customer before work started');
    expect(text).toContain('Paid by Cash Bank transfer Card (swipe) ✓ EcoCash InnBucks Other');
    expect(text).toContain('USD 120.00');
    expect(text).not.toContain('Applied to');
    expect(text).toContain('REFUND REF-0001 Page 1 of 1');
  });

  it('shows the date paid only when it differs from the Refund date', () => {
    const [text] = pageTexts(refundHtml({ ...refund, date: '2026-11-27' }, noAssets).html);
    expect(text).not.toContain('Date paid');
  });
});
