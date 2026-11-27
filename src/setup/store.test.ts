import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db';
import { nodePlatform } from '../db/node';
import {
  appLock,
  businessDetails,
  choosePeriod,
  documentCounters,
  emptyBusiness,
  finishSetup,
  firstNumber,
  periodSetting,
  problemsWith,
  saveBusinessDetails,
  saveFile,
  setAppLock,
  setStartDate,
  setStartingNumber,
  setupStatus,
  startDate,
  startNew,
  SetupError,
  type BusinessDetails,
} from './store';

let counter = 0;
const random = (n: number) => {
  let c = ++counter;
  const b = new Uint8Array(n);
  for (let i = n - 1; i >= 0; i--) {
    b[i] = c % 256;
    c = Math.floor(c / 256);
  }
  return b;
};

let db: Db;
beforeEach(() => {
  const opened = openDatabase({
    platform: nodePlatform(),
    appVersion: '1.0.0',
    clock: () => Date.UTC(2026, 10, 27, 12),
    random,
  });
  if (!opened.ok) throw new Error(opened.problem);
  db = opened.db;
});

const TODAY = '2026-11-27';
const demo: BusinessDetails = {
  ...emptyBusiness(),
  name: 'Demo Building Services',
  whatWeDo: 'Plumbing, tiling and building',
  phones: ['+263 77 123 4567'],
  email: 'demo@example.com',
  address: { line1: '12 Example Road', line2: '', suburb: 'Avondale', city: 'Harare', province: 'Harare', country: 'Zimbabwe' },
};

describe('first open', () => {
  it('is a new install until the User chooses Start new', () => {
    expect(setupStatus(db)).toBe('new');
    startNew(db, TODAY);
    expect(setupStatus(db)).toBe('started');
  });

  it('is set up once the wizard finishes, and stays so', () => {
    startNew(db, TODAY);
    saveBusinessDetails(db, demo, TODAY);
    finishSetup(db);
    expect(setupStatus(db)).toBe('done');
  });

  it('cannot finish without the Business name', () => {
    startNew(db, TODAY);
    expect(() => finishSetup(db)).toThrow(SetupError);
  });
});

describe('Business details', () => {
  beforeEach(() => startNew(db, TODAY));

  it('need a name, and a valid email when one is given', () => {
    expect(problemsWith(emptyBusiness())).toEqual({ name: 'Enter the name of your business.' });
    expect(problemsWith({ ...demo, email: 'demo at example' })).toEqual({
      email: 'Enter an email like name@example.com, or leave it empty.',
    });
    expect(problemsWith({ ...demo, brandColour: 'orange' })).toEqual({
      brandColour: 'Enter a colour like #C2410C, or pick one above.',
    });
    expect(problemsWith(demo)).toEqual({});
  });

  it('are saved and read back whole', () => {
    saveBusinessDetails(db, demo, TODAY);
    expect(businessDetails(db)).toEqual(demo);
  });

  it('keep each version with the date it took effect', () => {
    saveBusinessDetails(db, demo, TODAY);
    saveBusinessDetails(db, { ...demo, phones: ['+263 71 000 0000'] }, '2027-01-15');
    expect(businessDetails(db, '2026-12-31')?.phones).toEqual(['+263 77 123 4567']);
    expect(businessDetails(db, '2027-01-15')?.phones).toEqual(['+263 71 000 0000']);
    expect(businessDetails(db)?.phones).toEqual(['+263 71 000 0000']);
  });

  it('are refused when a problem remains', () => {
    expect(() => saveBusinessDetails(db, emptyBusiness(), TODAY)).toThrow(SetupError);
    expect(businessDetails(db)).toBeNull();
  });

  it('point to the logo and signature files they use', () => {
    const logo = saveFile(db, { kind: 'logo', path: 'files/logo.png', checksum: 'ab12', size: 2048 });
    saveBusinessDetails(db, { ...demo, logoFileId: logo }, TODAY);
    expect(businessDetails(db)?.logoFileId).toBe(logo);
    expect(() => saveBusinessDetails(db, { ...demo, signatureFileId: '0190a1b2-0000-7000-8000-000000000000' }, TODAY)).toThrow();
  });
});

describe('Document numbers', () => {
  it('start at 1 for each type', () => {
    expect(documentCounters(db).map((c) => [c.type, firstNumber(c), c.locked])).toEqual([
      ['QUO', 'QUO-0001', false],
      ['INV', 'INV-0001', false],
      ['REC', 'REC-0001', false],
      ['REF', 'REF-0001', false],
    ]);
  });

  it('can start from any whole number', () => {
    setStartingNumber(db, 'INV', 46);
    expect(firstNumber(documentCounters(db).find((c) => c.type === 'INV')!)).toBe('INV-0046');
    expect(() => setStartingNumber(db, 'INV', 0)).toThrow(SetupError);
    expect(() => setStartingNumber(db, 'INV', 1.5)).toThrow(SetupError);
  });

  it('lock once the first Document of that type is Issued', () => {
    db.run("UPDATE document_counter SET last_number = 1 WHERE type = 'QUO'");
    const quo = documentCounters(db).find((c) => c.type === 'QUO')!;
    expect(quo.locked).toBe(true);
    expect(() => setStartingNumber(db, 'QUO', 10)).toThrow(SetupError);
    // The database itself refuses it too.
    expect(() => db.run("UPDATE document_counter SET starting_number = 10 WHERE type = 'QUO'")).toThrow();
    setStartingNumber(db, 'INV', 10);
  });
});

describe('Start date', () => {
  beforeEach(() => startNew(db, TODAY));

  it('is today unless the User picks an earlier day', () => {
    expect(startDate(db)).toBe(TODAY);
    setStartDate(db, '2026-11-01', TODAY);
    expect(startDate(db)).toBe('2026-11-01');
  });

  it('cannot be later than today', () => {
    expect(() => setStartDate(db, '2026-11-28', TODAY)).toThrow(SetupError);
  });
});

describe('Accounting period', () => {
  beforeEach(() => startNew(db, TODAY));

  it('is monthly from January unless chosen otherwise', () => {
    expect(periodSetting(db, TODAY)).toEqual({ every: 1, yearStarts: 1 });
  });

  it('chosen during setup applies from the Start date', () => {
    expect(choosePeriod(db, { every: 3, yearStarts: 3 }, TODAY)).toBe(TODAY);
    expect(periodSetting(db, TODAY)).toEqual({ every: 3, yearStarts: 3 });
  });

  it('changed after setup applies from the next period, and past periods keep theirs', () => {
    saveBusinessDetails(db, demo, TODAY);
    finishSetup(db);
    expect(choosePeriod(db, { every: 12, yearStarts: 7 }, '2026-12-10')).toBe('2027-01-01');
    expect(periodSetting(db, '2026-12-31')).toEqual({ every: 1, yearStarts: 1 });
    expect(periodSetting(db, '2027-01-01')).toEqual({ every: 12, yearStarts: 7 });
  });

  it('changed twice in one period keeps only the latest choice for the next', () => {
    saveBusinessDetails(db, demo, TODAY);
    finishSetup(db);
    choosePeriod(db, { every: 12, yearStarts: 7 }, '2026-12-10');
    choosePeriod(db, { every: 3, yearStarts: 1 }, '2026-12-20');
    expect(periodSetting(db, '2027-01-01')).toEqual({ every: 3, yearStarts: 1 });
  });
});

describe('App lock', () => {
  beforeEach(() => startNew(db, TODAY));

  it('is off unless chosen, and can be changed', () => {
    expect(appLock(db)).toBe(false);
    setAppLock(db, true);
    expect(appLock(db)).toBe(true);
    setAppLock(db, false);
    expect(appLock(db)).toBe(false);
  });
});
