import { describe, expect, it } from 'vitest';
import { back, current, open, openPriceList, openReport, openSettings, replace, selectTab, start, tabs } from './navigation';

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
