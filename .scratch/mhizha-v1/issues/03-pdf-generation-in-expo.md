# PDF generation in Expo

Label: wayfinder:research
Type: research
Status: resolved

## Question

Can expo-print reproduce the reference designs (kept outside this repo)? Cover A4 sizing, embedded fonts, images, watermark, repeated headers and footers, page breaks, and differences between Android WebView versions. How are PDFs kept in app storage, shared to WhatsApp, and saved to a visible folder on Android 10 and newer? Name the fallback if it falls short.

## Answer

[docs/research/pdf-generation.md](../../../docs/research/pdf-generation.md) (layout tried in desktop Chromium; nothing run on a phone).

- Very likely yes with expo-print, if the app paginates itself: one fixed A4 block per page, each repeating header, footer and watermark. Inline fonts and images as base64.
- Move PDFs from cache to document storage. Store Issued PDFs; never re-render them.
- Sharing opens the Android share menu; it cannot preselect WhatsApp or confirm sending. Visible copies go through the folder picker.
- Fallback: `@cantoo/pdf-lib` with fontkit, then a local Android `PdfDocument` module.
- The designs are flat images: logo, watermark, font names and a continuation-page design are needed.
- Unknown until the phone test: page size and count, font loading, oldest WebView, speed, WhatsApp filename.
