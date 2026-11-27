// Where the User is in the app shell, and how the four tabs, Settings and the
// phone's back button move between places. Plain TypeScript, free of React.

export type TabId = 'home' | 'customers' | 'documents' | 'money';
export type TabIcon = 'home' | 'people' | 'doc' | 'wallet';

export type Tab = {
  id: TabId;
  label: string;
  icon: TabIcon;
  /** What an empty tab says: what will appear here and how it gets here. */
  empty: { title: string; body: string };
};

export const tabs: readonly Tab[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    empty: {
      title: 'Welcome to Mhizha',
      body: 'Tap New to add your first Customer, then make an Invoice for them.',
    },
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: 'people',
    empty: {
      title: 'No Customers yet',
      body: 'The people and organisations you quote or bill are listed here. Tap New to add one.',
    },
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: 'doc',
    empty: {
      title: 'No Documents yet',
      body: 'Your Quotations, Invoices, Receipts and Refunds are listed here. Tap New to make one.',
    },
  },
  {
    id: 'money',
    label: 'Money',
    icon: 'wallet',
    empty: {
      title: 'No money recorded yet',
      body: 'Money received and sales show here once you issue Invoices and record Payments.',
    },
  },
];

/** What the New button offers, in this order. */
export const newChoices = ['Quotation', 'Invoice', 'Payment', 'Customer'] as const;

/** The setup pages reached from Settings. */
export type SettingsPage = 'business' | 'numbers' | 'start' | 'period' | 'opening' | 'presales';

/** A screen opened over a tab, with a back button and no tabs or New button. */
export type Sub =
  | { screen: 'customer'; id: string }
  /** A new Customer without `id`, otherwise a change to one. */
  | { screen: 'customer-form'; id?: string }
  | { screen: 'site-form'; customerId: string; id?: string }
  | { screen: 'job-form'; customerId: string; id?: string }
  | { screen: 'job'; id: string }
  /** One step of making an Invoice, or a Quotation (`type: 'QUO'`). `id` is the Draft, once there is one; its own type then wins. */
  | { screen: 'invoice-step'; step: InvoiceStep; id?: string; type?: 'QUO' | 'INV' }
  /** An Issued Document, or a Draft opened from a list. */
  | { screen: 'document'; id: string }
  /** A Draft's pages as they would print, marked DRAFT. */
  | { screen: 'preview'; id: string }
  /** Recording a Payment; it asks who paid when `customerId` is not given. */
  | { screen: 'payment'; customerId?: string; quotationId?: string };

/** The steps of making a Quotation or Invoice, one question each: who, which Job, the lines, then check and issue. */
export type InvoiceStep = 'who' | 'job' | 'lines' | 'check';
export const invoiceSteps: readonly InvoiceStep[] = ['who', 'job', 'lines', 'check'];

/** Where the User is: a tab, Settings (with `page`, one of its setup pages), the Price list or the problem report, and any sub screens opened over it, last on top. */
/** `prices` is the Price list, `methods` the Payment methods and `help` the Help page, sub screens of Settings. `report` is the problem report; `from` says whether it was opened from a tab or Settings. */
export type Place =
  | { tab: TabId; screen: 'tab' | 'settings' | 'prices' | 'methods' | 'help'; page?: SettingsPage; subs?: readonly Sub[] }
  | { tab: TabId; screen: 'report'; from: 'tab' | 'settings'; page?: undefined; subs?: undefined };

export const start: Place = { tab: 'home', screen: 'tab' };

const withSubs = (from: Place, subs: readonly Sub[]): Place =>
  from.screen === 'report'
    ? from
    : subs.length > 0
      ? { tab: from.tab, screen: from.screen, subs }
      : { tab: from.tab, screen: from.screen };

export function selectTab(_from: Place, tab: TabId): Place {
  return { tab, screen: 'tab' };
}

export function openSettings(from: Place): Place {
  return { tab: from.tab, screen: 'settings' };
}

export function openSettingsPage(from: Place, page: SettingsPage): Place {
  return { tab: from.tab, screen: 'settings', page };
}

export function openPriceList(from: Place): Place {
  return { tab: from.tab, screen: 'prices' };
}

export function openPaymentMethods(from: Place): Place {
  return { tab: from.tab, screen: 'methods' };
}

export function openHelp(from: Place): Place {
  return { tab: from.tab, screen: 'help' };
}

/** The problem report, from Settings, Help or from the banner a failed check shows on a tab. */
export function openReport(from: Place): Place {
  return { tab: from.tab, screen: 'report', from: from.screen === 'settings' || from.screen === 'help' ? 'settings' : 'tab' };
}

/** Opens a sub screen on top. */
export function open(from: Place, sub: Sub): Place {
  return withSubs(from, [...(from.subs ?? []), sub]);
}

/** Swaps the top sub screen for another, as when a saved form shows what it made. */
export function replace(from: Place, sub: Sub): Place {
  return withSubs(from, [...(from.subs ?? []).slice(0, -1), sub]);
}

/** Closes every step and the preview of a Draft (once it is issued or deleted), then opens `then` if given. */
export function leaveDraft(from: Place, id: string, then?: Sub): Place {
  const kept = (from.subs ?? []).filter(
    (s) => !(s.screen === 'invoice-step' && (s.id === id || s.id === undefined)) && !(s.screen === 'preview' && s.id === id),
  );
  return withSubs(from, then ? [...kept, then] : kept);
}

/** The sub screen on top, or null when a tab or Settings shows. */
export function current(place: Place): Sub | null {
  return place.subs?.at(-1) ?? null;
}

/** The phone's back button: a sub screen closes, the report goes back where it came from, the Price list, Help and Settings pages go to Settings, Settings closes, other tabs go Home, Home exits. */
export function back(from: Place): Place | 'exit' {
  if (from.subs?.length) return withSubs(from, from.subs.slice(0, -1));
  if (from.screen === 'report') return { tab: from.tab, screen: from.from };
  if (from.screen === 'prices' || from.screen === 'methods' || from.screen === 'help') return { tab: from.tab, screen: 'settings' };
  if (from.screen === 'settings' && from.page) return { tab: from.tab, screen: 'settings' };
  if (from.screen === 'settings') return { tab: from.tab, screen: 'tab' };
  if (from.tab !== 'home') return start;
  return 'exit';
}
