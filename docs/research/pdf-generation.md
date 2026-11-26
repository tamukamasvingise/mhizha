# PDF generation in Expo

Ticket: `.scratch/mhizha-v1/issues/03-pdf-generation-in-expo.md`. Researched 2026-11-25 against
Expo SDK 58 (expo-print 58.0.9, branch `sdk-58` at `a41be306`) and Chromium `main` at `4a3dab22`
(stable Android WebView that day: 159). Nothing was run on an Android phone.

## Answer

**Very likely yes.** expo-print can reproduce all the designs if the app paginates the Document itself:
one fixed-size A4 block per page, each repeating the header, footer and watermark. Do not rely on CSS
to repeat them. Prove it on the real phone before building all the templates.

**Fallback:** draw the PDF in TypeScript with pdf-lib and its fontkit, which does not use WebView.
Second fallback: a small local Expo module using Android's own `PdfDocument`.

Keep PDFs in the app's document directory, share with expo-sharing, and save visible copies with
expo-file-system into a folder the user picks once.

## What the designs need (verified by opening the files)

- `Invoice`, `Quotation`, `Receipt`, `Classic`, and a two-page `Letterhead` (page 1 modern, page 2
  the classic style). All portrait, MediaBox 595.5 x 842.25 pt. `Classic` was checked by its text and
  structure only, not viewed.
- Each page is one flat 2382 x 3369 image with an invisible text layer (the only font is `Glyphless`).
  No fonts, logo or watermark can be extracted cleanly; they need rebuilding or the original sources.
- Needs: serif text in several weights, a logo, a pale watermark behind the lower right, table
  rules, dotted lines, solid colour blocks, and on the modern letterhead full-bleed bands.
- Invoice has 7 rows and Quotation 9. There is no continuation-page design. The footer sits at the
  bottom edge and the signature line almost touches it.
- The typefaces look like Source Serif (classic) and Barlow (modern). That is a visual guess.

## How expo-print works on Android (verified in source)

Source [E1]: [PrintPDFRenderTask.kt](https://github.com/expo/expo/blob/a41be306e5087506ac3344c59ea1faea067a4f56/packages/expo-print/android/src/main/java/expo/modules/print/PrintPDFRenderTask.kt).
It creates an off-screen system WebView, loads the HTML, waits for `onPageFinished`, then writes the PDF
through WebView's print adapter. Consequences:

| Topic | Finding |
|---|---|
| JavaScript | expo-print never enables it [E1]; the WebView default is off ([WebSettings](https://developer.android.com/reference/android/webkit/WebSettings)). Templates cannot measure or paginate themselves. |
| Files | HTML is loaded with a null base URL [E1], and apps targeting Android 11+ have WebView file access off by default ([WebSettings](https://developer.android.com/reference/android/webkit/WebSettings)). Inline every image and font as a base64 `data:` URI. Expo itself only requires this [on iOS](https://docs.expo.dev/versions/v58.0.0/sdk/print/#local-images). |
| Text size | `textZoom` exists to override the phone's font scaling ([changelog](https://github.com/expo/expo/blob/a41be306e5087506ac3344c59ea1faea067a4f56/packages/expo-print/CHANGELOG.md)). Always pass 100. |
| Page count | `numberOfPages` is content height divided by page height, not the PDF's real count [E1]. Ignore it. |
| Output | A random-UUID PDF in the cache directory ([FileUtils.kt](https://github.com/expo/expo/blob/a41be306e5087506ac3344c59ea1faea067a4f56/packages/expo-print/android/src/main/java/expo/modules/print/FileUtils.kt)). |
| Crash handling | expo-print's client [E1] does not implement `onRenderProcessGone`, the hook Android says lets an app [survive losing the renderer](https://developer.android.com/guide/webapps/managing-webview#termination-handle). Save the record before rendering. |

## Feature by feature

**A4 size.** Defaults are US Letter, 612 x 792 [E1], so pass a size. Options are whole numbers
([PrintOptions.kt](https://github.com/expo/expo/blob/a41be306e5087506ac3344c59ea1faea067a4f56/packages/expo-print/android/src/main/java/expo/modules/print/PrintOptions.kt)),
become thousandths of an inch [E1], and WebView truncates back to 72 dpi dots
([aw_pdf_exporter.cc](https://chromium.googlesource.com/chromium/src/+/4a3dab22fa3046c181f177123ad77e5e058bfeea/android_webview/browser/aw_pdf_exporter.cc)).
Worked out from that: 595 x 842 gives 595 x **841** pt; 595 x 843 gives 595 x 842. Start with
`width: 595, height: 843`, `@page { size: 595pt 842pt; margin: 0 }`, and blocks 841pt high so rounding
cannot create a blank page. The result on a phone is unverified.

**Margins.** Expo says Android margins depend on the WebView and are set with
[`@page`](https://docs.expo.dev/versions/v58.0.0/sdk/print/#page-margins); the `margins` option is iOS only.
Reading current Chromium, CSS margins and page size apply on this path
([print_render_frame_helper.cc](https://chromium.googlesource.com/chromium/src/+/4a3dab22fa3046c181f177123ad77e5e058bfeea/components/printing/renderer/print_render_frame_helper.cc),
`ignore_css_margins_ = false`). Android's guide says CSS print attributes are
[not supported](https://developer.android.com/training/printing/html-docs). They conflict: use zero
margins with padding inside the block, and pass the size both ways.

**Background colours.** WebView always prints them (`set_should_print_backgrounds(true)` in aw_pdf_exporter.cc above).

**Embedded fonts.** `@font-face` with a `data:` URI worked in the local test below. Risk: if a font is
still loading when printing begins, Blink switches to a fallback font
([remote_font_face_source.cc](https://chromium.googlesource.com/chromium/src/+/4a3dab22fa3046c181f177123ad77e5e058bfeea/third_party/blink/renderer/core/css/remote_font_face_source.cc),
for the default `font-display`). expo-print does not wait for fonts beyond `onPageFinished` [E1]. Inspect
the embedded fonts in test PDFs. Bundle only the weights used.

**Images and watermark.** Inline PNG or SVG; a pale pre-tinted image behind the content avoids
depending on opacity.

**Repeated headers and footers.** Android says WebView printing
[cannot add headers, footers or page numbers](https://developer.android.com/training/printing/html-docs);
HTML content can imitate them.

- CSS fixed boxes [repeat on every page](https://www.w3.org/TR/CSS22/visuren.html#fixed-positioning), but do
  not reserve space. In the local test, ones offset into the page margin landed in the wrong place.
- Chromium repeats `thead`/`tfoot` only if at most a quarter of the page high and with an avoiding
  `break-inside`
  ([table_layout_algorithm.cc](https://chromium.googlesource.com/chromium/src/+/4a3dab22fa3046c181f177123ad77e5e058bfeea/third_party/blink/renderer/core/layout/table/table_layout_algorithm.cc)).
- `@page` margin boxes with page numbers need [Chrome 131+](https://developer.chrome.com/blog/print-margins).
  Too new to rely on.
- Writing them into each page block needs none of this, and allows "Page 2 of 3".

**Page breaks.** Each block gets `break-after: page` except the last; rows get `break-inside: avoid`.
TypeScript must know how many rows fit. Since JavaScript is off, wrap descriptions using a table of glyph
widths from the bundled fonts and print those lines with `white-space: nowrap`. Simpler start: a
conservative character count per line. Unit tests can cover either.

**WebView versions.** WebView is a separate package needing
[regular updates](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/faq.md), so two
phones on the same Android version can differ. `getCurrentWebViewPackage()`
[reports the version](https://developer.android.com/guide/webapps/managing-webview#version-api) but needs
native code or a library. Use simple CSS (absolute positions, tables, pt units), no margin boxes. Store an
Issued Document's PDF and never re-render it, so an update cannot change it.

## Local test (evidence, not proof)

Throwaway HTML printed by desktop Chromium 159.0.8154.6 (`chrome-headless-shell --print-to-pdf`), the same
major version as current WebView. It does not exercise expo-print or the WebView adapter.

- Explicit page blocks, three pages: correct header, footer, page number, watermark and column headings
  on each, exactly three pages, full bleed, page size 594.96 x 841.92 pt, `data:` font embedded.
- CSS repetition: `thead` and margin boxes worked; the fixed header and footer were misplaced over rows.

## Storage, sharing, visible folder

**Keep (verified).** Move the cache file to `Paths.document`, which Expo describes as
[safe from system deletion](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/); Android
[may delete cache files](https://developer.android.com/training/data-storage/app-specific). Give it a proper
filename. Uninstalling [removes app storage](https://developer.android.com/training/data-storage/app-specific),
so backup must include these files.

**WhatsApp (partly verified).** `shareAsync(uri, { mimeType: 'application/pdf' })` sends `ACTION_SEND` with a
read grant through a FileProvider and the chooser; it needs a `file://` URI and has no target-app or
recipient option
([SharingModule.kt](https://github.com/expo/expo/blob/a41be306e5087506ac3344c59ea1faea067a4f56/packages/expo-sharing/android/src/main/java/expo/modules/sharing/SharingModule.kt)).
Its promise resolves when the chooser returns, whatever the result, so it does not prove sending. The user
picks WhatsApp and the chat. A `wa.me` link
[pre-fills text](https://faq.whatsapp.com/5913398998672934); no documented file attachment was found.

**Visible folder (verified in docs and source).** `Directory.pickDirectoryAsync()` opens the system folder
picker and takes a persistable permission
([FilePickerContract.kt](https://github.com/expo/expo/blob/a41be306e5087506ac3344c59ea1faea067a4f56/packages/expo-file-system/android/src/main/java/expo/modules/filesystem/FilePickerContract.kt)).
Save the URI, then copy each PDF there. No storage permission is needed and the copies
[survive uninstall](https://developer.android.com/training/data-storage/shared/documents-files). Limits from
that page: on Android 11+ the user cannot pick the `Download` folder or the storage root, so suggest
`Documents/Mhizha`; access ends if the folder is moved or deleted, so detect that and ask again. The
alternative, `MediaStore`, can hold files in Download on Android 10+, but Android
[recommends the picker route for general files](https://developer.android.com/training/data-storage/shared/media)
and no Expo API for it was found, so it would likely need native code. `WRITE_EXTERNAL_STORAGE` has
[no effect](https://developer.android.com/training/data-storage) when targeting Android 11+.

## Fallbacks

1. **pdf-lib**: its README claims [React Native testing](https://github.com/Hopding/pdf-lib#readme), custom
   fonts via fontkit, and PNG/JPEG. It does not depend on WebView, but every line is positioned by hand.
   The original was last published [in 2021](https://registry.npmjs.org/pdf-lib); the fork
   `@cantoo/pdf-lib` published [2.11.1 in September 2026](https://registry.npmjs.org/@cantoo/pdf-lib) and
   also [claims React Native testing](https://github.com/cantoo-scribe/pdf-lib#readme). Not run on Hermes here.
2. **Android [`PdfDocument`](https://developer.android.com/reference/android/graphics/pdf/PdfDocument)**:
   platform API since level 19, drawn on a canvas, in a local Kotlin module. Most native code to own.

Another library that prints HTML through WebView would share the same engine, so is not a real fallback.

Switch if, on the test phone, fonts are substituted, the size is not A4, blank pages appear, or output
differs visibly on a second phone.

## Unverified: test on the phone

- Actual page size, page count, font embedding and first-run font timing through expo-print.
- Output on the oldest WebView to support, and generation time and memory on a cheap phone.
- WhatsApp receiving the PDF with its intended filename.
- Folder permission after restart, and behaviour on Android 10 and on the actual brand.
- pdf-lib with fontkit on Hermes.

Needed from the owner: logo, watermark and font names or source files behind the designs, and a design
for continuation pages.
