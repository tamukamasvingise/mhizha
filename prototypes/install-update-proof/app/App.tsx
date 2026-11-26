// PROTOTYPE, throwaway: Install and update proof. Not Mhizha code.
// Each launch opens the database, runs any pending upgrade steps (copying the
// database first), saves one record and one PDF on the very first open, then
// reports what it finds. It reports facts only; run-proof.sh judges them.
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as Print from 'expo-print';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { BUILD } from './proof-version';

const DB_NAME = 'mhizha-proof.db';
const COPY_NAME = DB_NAME + '.before-upgrade';

type Step = { to: number; run: (db: SQLite.SQLiteDatabase) => void };

// Numbered, forward-only steps. Build 2 adds step 2; build 3 adds a step that fails on purpose.
const ALL_STEPS: Step[] = [
  {
    to: 1,
    run: (db) =>
      db.execSync(`
        CREATE TABLE customer (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE file (id TEXT PRIMARY KEY, kind TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL);
        CREATE TABLE document (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL REFERENCES customer(id),
          number TEXT NOT NULL UNIQUE,
          total_cents INTEGER NOT NULL CHECK (total_cents > 0),
          pdf_file_id TEXT REFERENCES file(id)
        );`),
  },
  {
    to: 2,
    run: (db) =>
      db.execSync(`
        ALTER TABLE customer ADD COLUMN whatsapp TEXT;
        CREATE TABLE follow_up (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customer(id), due_date TEXT NOT NULL);`),
  },
  {
    to: 3,
    run: (db) => {
      db.execSync('CREATE TABLE site (id TEXT PRIMARY KEY);');
      throw new Error('Step 3 fails on purpose');
    },
  },
];
const STEPS = ALL_STEPS.filter((s) => s.to <= BUILD);

function dbDir(): Directory {
  const d = SQLite.defaultDatabaseDirectory;
  return new Directory(d.startsWith('file://') ? d : 'file://' + d);
}

function openDb(): SQLite.SQLiteDatabase {
  const db = SQLite.openDatabaseSync(DB_NAME);
  db.execSync('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON;');
  return db;
}

async function sha256(file: File): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, await file.base64());
}

const count = (db: SQLite.SQLiteDatabase, table: string) =>
  db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)!.n;

async function runProof() {
  const t0 = Date.now();
  const r: Record<string, unknown> = { build: BUILD, safetyCopyMade: false, restoredCopy: false, upgradeError: null, seeded: false };

  let db = openDb();
  db.execSync(`CREATE TABLE IF NOT EXISTS upgrade_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, from_version INTEGER, to_version INTEGER,
    started TEXT, finished TEXT, result TEXT)`);
  const before = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')!.user_version;
  r.dbVersionBefore = before;

  const pending = STEPS.filter((s) => s.to > before);
  const live = new File(dbDir(), DB_NAME);
  const copy = new File(dbDir(), COPY_NAME);

  // Safety copy: only when an existing database is about to be upgraded.
  if (pending.length > 0 && before > 0) {
    db.closeSync();
    if (copy.exists) copy.delete();
    live.copy(copy);
    r.safetyCopyMade = copy.exists;
    r.safetyCopySize = copy.size;
    db = openDb();
  }

  for (const step of pending) {
    const started = new Date().toISOString();
    try {
      db.withTransactionSync(() => {
        step.run(db);
        db.execSync(`PRAGMA user_version = ${step.to}`);
        db.runSync(
          'INSERT INTO upgrade_log (from_version, to_version, started, finished, result) VALUES (?, ?, ?, ?, ?)',
          step.to - 1, step.to, started, new Date().toISOString(), 'ok',
        );
      });
    } catch (e) {
      r.upgradeError = String(e);
      db.closeSync();
      if (copy.exists) {
        live.delete();
        copy.copy(live);
        r.restoredCopy = true;
      }
      db = openDb();
      db.runSync(
        'INSERT INTO upgrade_log (from_version, to_version, started, finished, result) VALUES (?, ?, ?, ?, ?)',
        step.to - 1, step.to, started, new Date().toISOString(), 'failed; returned to copy',
      );
      break;
    }
  }
  r.dbVersionAfter = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')!.user_version;

  // First open ever: one Customer, one Document and its PDF, saved together.
  if (count(db, 'customer') === 0) {
    const customerId = Crypto.randomUUID();
    const docId = Crypto.randomUUID();
    const fileId = Crypto.randomUUID();
    const { uri } = await Print.printToFileAsync({
      html: `<html><body style="font-family:sans-serif;padding:40px">
        <h1>INVOICE INV-0001</h1><p>Proof Customer</p><p>Total: $125.00</p></body></html>`,
    });
    const pdfDir = new Directory(Paths.document, 'pdfs');
    if (!pdfDir.exists) pdfDir.create();
    const pdf = new File(pdfDir, `${docId}.pdf`);
    new File(uri).move(pdf);
    const hash = await sha256(pdf);
    db.withTransactionSync(() => {
      db.runSync('INSERT INTO customer (id, name, created_at) VALUES (?, ?, ?)', customerId, 'Proof Customer', new Date().toISOString());
      db.runSync('INSERT INTO file (id, kind, path, sha256, size) VALUES (?, ?, ?, ?, ?)', fileId, 'pdf', `pdfs/${docId}.pdf`, hash, pdf.size);
      db.runSync('INSERT INTO document (id, customer_id, number, total_cents, pdf_file_id) VALUES (?, ?, ?, ?, ?)', docId, customerId, 'INV-0001', 12500, fileId);
    });
    r.seeded = true;
  }

  r.counts = { customer: count(db, 'customer'), document: count(db, 'document'), file: count(db, 'file') };

  const f = db.getFirstSync<{ path: string; sha256: string; size: number }>('SELECT path, sha256, size FROM file LIMIT 1');
  if (f) {
    const pdf = new File(Paths.document, f.path);
    r.pdf = pdf.exists
      ? { exists: true, size: pdf.size, sizeMatches: pdf.size === f.size, shaMatches: (await sha256(pdf)) === f.sha256 }
      : { exists: false };
  }

  r.upgradeLog = db.getAllSync<{ to_version: number; result: string }>('SELECT to_version, result FROM upgrade_log ORDER BY id');
  r.hasWhatsappColumn = db
    .getAllSync<{ name: string }>('PRAGMA table_info(customer)')
    .some((c) => c.name === 'whatsapp');
  r.elapsedMs = Date.now() - t0;
  db.closeSync();
  return r;
}

export default function App() {
  const [result, setResult] = useState<string>('Running proof...');
  useEffect(() => {
    runProof()
      .then((r) => {
        console.log('PROOF_RESULT ' + JSON.stringify(r));
        setResult(JSON.stringify(r, null, 2));
      })
      .catch((e) => {
        console.log('PROOF_RESULT ' + JSON.stringify({ build: BUILD, crashed: String(e) }));
        setResult('Crashed: ' + String(e));
      });
  }, []);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Install and update proof, build {BUILD}</Text>
      <Text style={styles.body}>{result}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 12, fontFamily: 'monospace' },
});
