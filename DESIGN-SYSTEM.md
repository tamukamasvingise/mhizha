# Mhizha design system

The look of the Mhizha app. Taken from the Main screens prototype (branch `prototype/main-screens`, decision in `.scratch/mhizha-v1/issues/09-main-screens-prototype.md`). The values live in `src/ui/tokens.ts`; that file is the only place a raw colour or size may appear. `src/ui/tokens.test.ts` checks every colour pair below meets WCAG contrast in both modes.

## Stack

Expo SDK 58, React Native, TypeScript. Phone only, portrait. Styles are React Native `StyleSheet` objects built from the tokens; icons are `react-native-svg`. The ui-standards rules apply; its web Stack notes (CSS custom properties, Playwright and axe) do not. Their stand-ins here:

- Tokens: `src/ui/tokens.ts`, read through `useColours()` in `src/ui/theme.ts`.
- Light and dark: `useColorScheme()` follows the phone. No in-app switch.
- Checks: the token contrast test on every push, and the emulator launch check, which dumps each screen's accessibility tree and screenshots it in light and dark at 720x1280 (`scripts/ci/launch-check.sh`, artifacts `launch-check-*`).

## Theme: one orange accent on greys

| Token | Light | Dark | Used for |
|---|---|---|---|
| `page` | #F6F7F7 | #0A0A0A | screen background |
| `surface` | #FFFFFF | #141416 | bars, lists, sheets, buttons |
| `fg` | #18181B | #F4F4F5 | text |
| `label` | #52525B | #A1A1AA | labels, secondary text, tab labels |
| `line` | #E4E4E7 | #27272A | hairline dividers (decoration only) |
| `input` | #71717A | #71717A | input and button borders |
| `tint` | #F4F4F5 | #1C1C1F | pressed rows, quiet chips |
| `primary` | #C2410C | #FB923C | the primary button, the New button |
| `primaryFg` | #FFFFFF | #0A0A0A | text on `primary` |
| `brand` | #C2410C | #FB923C | the Mhizha mark, step bars |
| `sel` | #FFEDD5 | #431407 | current tab pill, selected items |
| `selFg` | #9A3412 | #FED7AA | text and icon on `sel` |
| `bad` | #B91C1C | #F87171 | errors, overdue amounts, Cancel |
| `ring` | #C2410C | #FB923C | focus |
| `scrim` | black 50% | black 60% | behind sheets |
| `toast` / `toastFg` | #18181B / #F4F4F5 | #F4F4F5 / #0A0A0A | the toast |

Colour rules:

- Orange only on the primary button, the New button, the current tab, selected items, the mark, step bars and focus. Everything else is grey.
- Red only for errors, overdue amounts and Cancel, always with a second cue ("! " prefix, words).
- No warning or success colours. Notices are grey cards with a bold title; "Paid" is a word, with a "✓ " prefix.

## Shape, space, type

- Radius: `r` 8 (buttons, inputs, lists), `rL` 16 (sheets, the New button), `pill` 999 (chips, tab pill).
- Space: `s05` 2, `s1` 4, `s2` 8, `s3` 12, `s4` 16, `s6` 24, `s8` 32 (dp).
- Type (sp): `s` 14, `m` 16 (body), `l` 24 (step question), `xl` 32 (the big figure, weight 700). Line height 1.4 times. At most three sizes on a screen. System font (Roboto); PDF fonts are separate.
- Icons: 20 (`icon`), 18 in buttons and rows (`iconS`); Lucide-style outline, stroke 2, round caps and joins. The mark is 22.
- Touch: every target at least 44x44 (`touch`). Amounts: tabular figures, weight 600, right-aligned.

## Shell (App shell)

- Top bar, min 56, `surface` with a bottom hairline. On Home: the Mhizha mark and name; on other tabs: the tab's name, 16/600. Settings gear at the right on every tab. Sub screens (Settings): back button left, title.
- Bottom tabs, always in this order: Home, Customers, Documents, Money. Each min 60, icon in a 52x28 pill, 14 label in `label`. Current tab: `sel` pill, `selFg` icon and label, bold, and marked selected for screen readers.
- One New button above the tabs, right 16, min 52, radius 16, `primary`, plus icon and "New". Its sheet offers Quotation, Invoice, Payment, Customer.
- The phone's back button: closes a sub screen, then goes to Home from another tab, then leaves the app.
- Light and dark follow the phone.

## Layouts

- Root tab screen: top bar, scrolling content padded 16 with 16 between groups, bottom padding clear of the New button, then the tabs.
- Empty state: centred bold title, then a `label` line saying what will appear and how it gets there ("Tap New to ..."). An action button only when it leads somewhere that is built.
- Sub screen: top bar with back, no tabs, no New button.
- Problem screen (unexpected errors, records that could not be opened or updated): focused, no top bar, tabs or New button. The mark and name, a 24/700 title saying what happened, a `label` line saying what to do, then Restart (primary) and Send a problem report.
- Problem report (from Settings, Help, and from Send a problem report on the problem screen or the check banner): a `label` line saying it holds no Customer details, Share the report (primary), then the whole file in a `surface` list box, 14, selectable, so the User reads it before sharing.
- Check banner (a check on open failed): at the top of every tab, `surface` with a 1px `bad` border, radius 8, padding 12; "! A check failed. Please send a problem report." 16/600 in `bad`, then a `label` line that work goes on. Tapping it opens the problem report.
- Bottom sheet: `scrim`, `surface`, top radius 16, padding 16, a bold title, then its list, then Close. Slides up; fades instead when the phone asks for reduced motion.
- List: `surface`, 1px `line` border, radius 8; rows min 56, padding 12, title 16/600, subtitle 14 `label`.
- Settings: sections with a 14/600 `label` heading over a list. A row that opens a sub screen ends in a `label` chevron.
- Text field: a 14/600 label above, an optional 14 `label` hint, then the input: min 44, radius 8, 1px `input` border, 3px `ring` border while typing. An error shows under it in `bad` with "! " and the border turns `bad`.
- Toast: `toast` on the page's bottom, radius 8, 16 text in `toastFg`, an optional action such as Undo at the right; read out by screen readers; gone after 5 s.
- Price list (Settings > Documents and money): rows of name (16/600) with the price at the right (16/600, tabular) and "per day" under it; tap a row to change or delete it in a sheet; "Add an item" (primary) under the list.

## Rule changes

None.

Notes against the Should rules:

- Focus: every tappable thing is a `Tappable` (`src/ui/parts.tsx`), which draws a 3dp `ring` outline, offset 2, when a keyboard or switch gives it focus.
- Checks at 320/768/1280 px: phone only, portrait; checked at the baseline 720x1280 instead.
