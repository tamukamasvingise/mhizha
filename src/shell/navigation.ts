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

/** The setup pages reached from Settings. */
export type SettingsPage = 'business' | 'numbers' | 'start' | 'period';

export type Place = { tab: TabId; screen: 'tab' | 'settings'; page?: SettingsPage };

export const start: Place = { tab: 'home', screen: 'tab' };

export function selectTab(_from: Place, tab: TabId): Place {
  return { tab, screen: 'tab' };
}

export function openSettings(from: Place): Place {
  return { tab: from.tab, screen: 'settings' };
}

export function openSettingsPage(from: Place, page: SettingsPage): Place {
  return { tab: from.tab, screen: 'settings', page };
}

/** The phone's back button: a Settings page goes to Settings, Settings closes, other tabs go Home, Home exits. */
export function back(from: Place): Place | 'exit' {
  if (from.screen === 'settings' && from.page) return { tab: from.tab, screen: 'settings' };
  if (from.screen === 'settings') return { tab: from.tab, screen: 'tab' };
  if (from.tab !== 'home') return start;
  return 'exit';
}
