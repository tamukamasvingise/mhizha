import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Db } from '../db';
import { makeReport, shareReport } from '../health/share';
import { Button, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { radius, size, space } from '../ui/tokens';

// The problem report, shown in full before it is shared so the User can see it
// holds no Customer details. Used on its own screen from Settings and the
// check banner, and inside the problem screen.

type Status = 'ready' | 'sharing' | 'failed';

export function ProblemReportBody({ db }: { db: Db | null }) {
  const c = useColours();
  const [report] = useState(() => makeReport(db));
  const [status, setStatus] = useState<Status>('ready');

  async function share() {
    setStatus('sharing');
    try {
      await shareReport(report);
      setStatus('ready');
    } catch (e) {
      db?.logError('problem report: share', e);
      setStatus('failed');
    }
  }

  return (
    <View style={local.body}>
      <Text style={[parts.body, { color: c.label }]}>
        It holds no Customer details: only versions, logs, check results and record counts. Read it below, then share
        it with whoever helps you with Mhizha.
      </Text>
      <Button primary label={status === 'sharing' ? 'Opening the Share menu' : 'Share the report'} onPress={share} />
      <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.bad }]}>
        {status === 'failed' ? '! Mhizha could not open the Share menu. Try again.' : ''}
      </Text>
      <View style={[local.file, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[parts.small, local.fileName, { color: c.fg }]}>{report.fileName}</Text>
        <Text selectable style={[parts.small, { color: c.fg }]}>
          {report.text}
        </Text>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  body: { gap: space.s4 },
  file: { borderWidth: size.hairline, borderRadius: radius.r, padding: space.s3, gap: space.s2 },
  fileName: { fontWeight: '700' },
});
