// Invoice PDFs on the phone (spec section 10). App only: the page itself is
// made in invoice.ts. An Issued Invoice's PDF is made once, kept in the app's
// own `pdfs` folder with its checksum, and never made again or overwritten;
// sharing sends that same file. A Draft is only ever previewed.
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Db } from '../db';
import type { Documents } from '../documents';
import { fileRecord, saveFile, type BusinessDetails } from '../setup/store';
import { invoiceHtml, PAGE, type PrintAssets } from './invoice';

const FOLDER = 'pdfs';
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };

/** A kept picture as a data: URI, or null when it is missing or cannot be read. */
function pictureUri(db: Db, id: string | null): string | null {
  if (!id) return null;
  const r = fileRecord(db, id);
  if (!r) return null;
  const mime = MIME[r.path.split('.').pop()!.toLowerCase()];
  if (!mime) return null;
  try {
    return `data:${mime};base64,${new File(Paths.document, r.path).base64Sync()}`;
  } catch {
    return null;
  }
}

/** The logo, signature and fonts a page needs, all inside the page. */
export function printAssets(db: Db, b: BusinessDetails): PrintAssets {
  return { logo: pictureUri(db, b.logoFileId), signature: pictureUri(db, b.signatureFileId), fonts: true };
}

/** Turns the page into an A4 PDF in the cache folder; returns its address. */
export async function printHtml(html: string): Promise<string> {
  // 595 x 843 comes out as 595 x 842 points (A4) after WebView's rounding.
  const { uri } = await Print.printToFileAsync({ html, width: PAGE.width, height: 843, textZoom: 100 });
  return uri;
}

/**
 * Prints, trying again twice: the phone's WebView now and then fails a print
 * (Android 10's WebView mishandles the file it writes to), and the next try works.
 */
async function printWithRetries(html: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const uri = await printHtml(html);
      const file = new File(uri);
      if (file.exists && file.size > 0) return uri;
      throw new Error('The printed PDF is empty.');
    } catch (e) {
      if (attempt >= 3) throw e;
      console.warn(`MHIZHA_PDF_ERROR try ${attempt}: ${e instanceof Error ? e.message : String(e)}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const making = new Map<string, Promise<string>>();

/**
 * The PDF of an Issued Invoice: made from its frozen copy the first time it is
 * asked for (right after issuing), then always the same file. Returns the file record's ID.
 */
export function invoicePdf(db: Db, docs: Documents, id: string): Promise<string> {
  const have = docs.issued(id).pdfFileId;
  if (have) return Promise.resolve(have);
  let job = making.get(id);
  if (!job) {
    job = makeInvoicePdf(db, docs, id).finally(() => making.delete(id));
    making.set(id, job);
  }
  return job;
}

async function makeInvoicePdf(db: Db, docs: Documents, id: string): Promise<string> {
  const printed = docs.printable(id);
  const { html } = invoiceHtml(printed, printAssets(db, printed.business));
  const made = new File(await printWithRetries(html));
  // Each Invoice gets its own folder, so the shared file keeps a plain name ("INV-0001.pdf").
  const dir = new Directory(Paths.document, FOLDER, id);
  if (!dir.exists) dir.create({ intermediates: true });
  const name = `${printed.number}.pdf`;
  const kept = new File(dir, name);
  if (kept.exists) kept.delete(); // left by an earlier try that was never recorded
  made.move(kept);
  const checksum = await kept.digest('SHA-256');
  const size = kept.size;
  return db.transaction(() => {
    const fileId = saveFile(db, { kind: 'pdf', path: `${FOLDER}/${id}/${name}`, checksum, size });
    docs.setPdf(id, fileId);
    return fileId;
  });
}

/** Opens the Share menu with the Issued Invoice's PDF. */
export async function shareInvoicePdf(db: Db, docs: Documents, id: string): Promise<void> {
  const fileId = await invoicePdf(db, docs, id);
  const r = fileRecord(db, fileId);
  const file = r ? new File(Paths.document, r.path) : null;
  if (!file?.exists) throw new Error('The PDF file is missing.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `Share ${docs.issued(id).number}` });
}
