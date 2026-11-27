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
      body: 'Tap New to add your first Customer, then make a Quotation for them.',
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

/** A screen opened over a tab, with a back button and no tabs or New button. */
export type Sub =
  | { screen: 'customer'; id: string }
  /** A new Customer without `id`, otherwise a change to one. */
  | { screen: 'customer-form'; id?: string }
  | { screen: 'site-form'; customerId: string; id?: string }
  | { screen: 'job-form'; customerId: string; id?: string }
  | { screen: 'job'; id: string };

/** Where the User is: a tab, Settings or the Price list, and any sub screens opened over it, last on top. */
/** `prices` is the Price list, a sub screen of Settings. */
export type Place = { tab: TabId; screen: 'tab' | 'settings' | 'prices'; subs?: readonly Sub[] };

export const start: Place = { tab: 'home', screen: 'tab' };

const withSubs = (from: Place, subs: readonly Sub[]): Place =>
  subs.length > 0 ? { tab: from.tab, screen: from.screen, subs } : { tab: from.tab, screen: from.screen };

export function selectTab(_from: Place, tab: TabId): Place {
  return { tab, screen: 'tab' };
}

export function openSettings(from: Place): Place {
  return { tab: from.tab, screen: 'settings' };
}

export function openPriceList(from: Place): Place {
  return { tab: from.tab, screen: 'prices' };
}

/** Opens a sub screen on top. */
export function open(from: Place, sub: Sub): Place {
  return withSubs(from, [...(from.subs ?? []), sub]);
}

/** Swaps the top sub screen for another, as when a saved form shows what it made. */
export function replace(from: Place, sub: Sub): Place {
  return withSubs(from, [...(from.subs ?? []).slice(0, -1), sub]);
}

/** The sub screen on top, or null when a tab or Settings shows. */
export function current(place: Place): Sub | null {
  return place.subs?.at(-1) ?? null;
}

/** The phone's back button: a sub screen closes, the Price list goes to Settings, Settings closes, other tabs go Home, Home exits. */
export function back(from: Place): Place | 'exit' {
  if (from.subs?.length) return withSubs(from, from.subs.slice(0, -1));
  if (from.screen === 'prices') return { tab: from.tab, screen: 'settings' };
  if (from.screen === 'settings') return { tab: from.tab, screen: 'tab' };
  if (from.tab !== 'home') return start;
  return 'exit';
}
