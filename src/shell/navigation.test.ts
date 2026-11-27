import { describe, expect, it } from 'vitest';
import { back, openReport, openSettings, selectTab, start, tabs } from './navigation';

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

  it('goes back to Home from another tab, then lets the phone close the app', () => {
    const fromDocuments = back({ tab: 'documents', screen: 'tab' });
    expect(fromDocuments).toEqual(start);
    expect(back(start)).toBe('exit');
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
