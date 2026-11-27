import { describe, expect, it } from 'vitest';
import { back, openSettings, openSettingsPage, selectTab, start, tabs } from './navigation';

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

describe('Settings pages', () => {
  it('open from Settings and go back to Settings', () => {
    const settings = openSettings(start);
    const page = openSettingsPage(settings, 'numbers');
    expect(page).toEqual({ tab: 'home', screen: 'settings', page: 'numbers' });
    expect(back(page)).toEqual({ tab: 'home', screen: 'settings' });
  });
});
