import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Nav } from '../../people/screens/common';
import { printAssets } from '../../pdf/files';
import { invoiceHtml, screenHtml } from '../../pdf/invoice';
import { useDb } from '../../shell/Records';
import { SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { size, space } from '../../ui/tokens';
import { useDocuments } from './common';

// A Draft's pages as they would print, marked DRAFT. Rebuilt each time it is
// opened, from the Draft as it stands. There is no Share or Print here: a
// Draft is never sent; issuing it makes the PDF.

export function PreviewScreen({ id, nav }: { id: string; nav: Nav }) {
  const c = useColours();
  const db = useDb();
  const d = useDocuments();
  const { width } = useWindowDimensions();
  const page = useMemo(() => {
    try {
      const printed = d.printable(id);
      const { html, pages } = invoiceHtml(printed, printAssets(db, printed.business));
      return { html: screenHtml(html, width, space.s4, c.page), pages };
    } catch {
      return null;
    }
  }, [d, db, id, width, c.page]);

  return (
    <View style={styles.screen}>
      <SubTopBar title="Draft Invoice preview" onBack={nav.back} />
      <View style={[styles.note, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
        <Text style={[parts.small, { color: c.label }]}>
          {page
            ? `${page.pages === 1 ? 'One page' : `${page.pages} pages`}, marked DRAFT. A Draft can't be shared. Issue it to share the PDF.`
            : 'The preview could not be made. Go back and try again; if it keeps happening, send a problem report from Settings.'}
        </Text>
      </View>
      {page ? (
        <WebView
          style={[styles.screen, { backgroundColor: c.page }]}
          source={{ html: page.html }}
          javaScriptEnabled={false}
          setSupportMultipleWindows={false}
          textZoom={100}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: c.page }]}>
              <ActivityIndicator color={c.primary} accessibilityLabel="Making the preview" />
            </View>
          )}
          accessibilityLabel="The Draft Invoice's pages"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  note: { paddingHorizontal: space.s4, paddingVertical: space.s3, borderBottomWidth: size.hairline },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
