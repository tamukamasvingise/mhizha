import { describe, expect, it } from 'vitest';
import { invoiceHtml } from './invoice';
import { pdfFacts, sampleInvoice } from './selfTest';

describe('the PDF check for the emulator', () => {
  it('reads the page count, page sizes and fonts from a PDF', () => {
    const pdf = [
      '1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R] /Count 2 >> endobj',
      '2 0 obj << /Type /Page /MediaBox [0 0 594.95996 841.91998] >> endobj',
      '3 0 obj <</Type/Page/MediaBox[0 0 595 842]>> endobj',
      '4 0 obj << /Type /Font /BaseFont /AAAAAA+Inter-Bold >> endobj',
      '5 0 obj << /Type /Font /BaseFont /BAAAAA+Inter-Regular >> endobj',
    ].join('\n');
    expect(pdfFacts(pdf)).toEqual({ pages: 2, sizes: ['595x842', '595x842'], fonts: ['Inter-Bold', 'Inter-Regular'] });
  });

  it('uses a made-up Invoice that runs onto several pages', () => {
    expect(invoiceHtml(sampleInvoice(40, 'Inter'), { logo: null, signature: null, fonts: true }).pages).toBeGreaterThan(1);
  });
});
