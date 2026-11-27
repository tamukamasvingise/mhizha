import { describe, expect, it } from 'vitest';
import { back, openPriceList, openSettings, selectTab, start, tabs } from './navigation';

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
