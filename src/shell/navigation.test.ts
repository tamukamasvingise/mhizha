import { describe, expect, it } from 'vitest';
import { back, current, leaveDraft, open, openPriceList, openReport, openSettings, openSettingsPage, replace, selectTab, start, tabs } from './navigation';

describe('the shell', () => {
  it('opens on Home', () => {
    expect(start).toEqual({ tab: 'home', screen: 'tab' });
  });

  it('has the four tabs in a fixed order', () => {
    expect(tabs.map((t) => t.label)).toEqual(['Home', 'Customers', 'Documents', 'Money']);
  });

  it('moves between tabs', () => {
    expect(selectTab(start, 'money')).toEqual({ tab: 'money', screen: 'tab' });
  });

  it('opens Settings over the current tab and goes back to it', () => {
    const settings = openSettings(selectTab(start, 'customers'));
    expect(settings.screen).toBe('settings');
    expect(back(settings)).toEqual({ tab: 'customers', screen: 'tab' });
  });

  it('opens the Price list from Settings and goes back to Settings', () => {
    const prices = openPriceList(openSettings(selectTab(start, 'money')));
    expect(prices).toEqual({ tab: 'money', screen: 'prices' });
    expect(back(prices)).toEqual({ tab: 'money', screen: 'settings' });
  });

  it('goes back to Home from another tab, then lets the phone close the app', () => {
    const fromDocuments = back({ tab: 'documents', screen: 'tab' });
    expect(fromDocuments).toEqual(start);
    expect(back(start)).toBe('exit');
  });
});

describe('Settings pages', () => {
  it('open from Settings and go back to Settings', () => {
    const settings = openSettings(start);
    const page = openSettingsPage(settings, 'numbers');
    expect(page).toEqual({ tab: 'home', screen: 'settings', page: 'numbers' });
    expect(back(page)).toEqual({ tab: 'home', screen: 'settings' });
  });
});

describe('sub screens', () => {
  it('opens a Customer over the Customers tab, then a Job over it, and back returns one at a time', () => {
    const list = selectTab(start, 'customers');
    const customer = open(list, { screen: 'customer', id: 'c1' });
    const job = open(customer, { screen: 'job', id: 'j1' });
    expect(current(job)).toEqual({ screen: 'job', id: 'j1' });
    expect(back(job)).toEqual(customer);
    expect(back(customer)).toEqual(list);
  });

  it('a saved form gives way to what it made', () => {
    const form = open(selectTab(start, 'customers'), { screen: 'customer-form' });
    const made = replace(form, { screen: 'customer', id: 'c1' });
    expect(made.subs).toEqual([{ screen: 'customer', id: 'c1' }]);
    expect(back(made)).toEqual({ tab: 'customers', screen: 'tab' });
  });

  it('changing tab closes the sub screens', () => {
    const customer = open(selectTab(start, 'customers'), { screen: 'customer', id: 'c1' });
    expect(selectTab(customer, 'home')).toEqual(start);
    expect(current(start)).toBeNull();
  });
});

describe('the problem report screen', () => {
  it('opens from Settings and goes back to Settings', () => {
    const settings = openSettings(selectTab(start, 'money'));
    const report = openReport(settings);
    expect(report.screen).toBe('report');
    expect(back(report)).toEqual(settings);
  });

  it('opens from the check banner on a tab and goes back to that tab', () => {
    const tab = selectTab(start, 'customers');
    expect(back(openReport(tab))).toEqual(tab);
  });
});

describe('making an Invoice step by step', () => {
  const customer = { screen: 'customer', id: 'c1' } as const;
  const step = (s: 'who' | 'job' | 'lines' | 'check', id?: string) =>
    id ? ({ screen: 'invoice-step', step: s, id } as const) : ({ screen: 'invoice-step', step: s } as const);

  it('each step opens on top, so back goes to the step before', () => {
    let place = open(selectTab(start, 'customers'), customer);
    place = open(place, step('job', 'd1'));
    place = open(place, step('lines', 'd1'));
    expect(current(back(place) as typeof place)).toEqual(step('job', 'd1'));
  });

  it('leaving the Draft closes every step of it and can open what it became', () => {
    let place = open(selectTab(start, 'customers'), customer);
    for (const s of ['who', 'job', 'lines', 'check'] as const) place = open(place, step(s, 'd1'));
    expect(leaveDraft(place, 'd1').subs).toEqual([customer]);
    expect(leaveDraft(place, 'd1', { screen: 'document', id: 'd1' }).subs).toEqual([customer, { screen: 'document', id: 'd1' }]);
  });
});
