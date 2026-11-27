import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../../ui/Icon';
import { List, Row, SmallButton } from '../../ui/forms';
import { Button, EmptyState, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { radius, size, space } from '../../ui/tokens';
import { usePeople, type Nav } from './common';

// The Customers tab: search, then every Customer by name with their first Site
// and "Follow up due". Archived Customers are behind "Show archived".

export function CustomersTab({ nav }: { nav: Pick<Nav, 'open'> }) {
  const c = useColours();
  const p = usePeople();
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const all = p.customers({ archived });
  const shown = search.trim() === '' ? all : p.customers({ search, archived });
  const anyArchived = archived || p.customers({ archived: true }).length > 0;

  if (!archived && all.length === 0 && !anyArchived)
    return (
      <View style={local.gap}>
        <EmptyState
          title="No Customers yet"
          body="Add the people and organisations you quote or bill. You can call or WhatsApp them from here."
        />
        <Button primary label="Add a Customer" onPress={() => nav.open({ screen: 'customer-form' })} />
      </View>
    );

  return (
    <View style={local.gap}>
      <View style={[local.search, { borderColor: c.input, backgroundColor: c.surface }]}>
        <Icon name="search" colour={c.label} px={size.iconS} />
        <TextInput
          accessibilityLabel={archived ? 'Search archived Customers' : 'Search Customers'}
          placeholder="Name or phone number"
          placeholderTextColor={c.label}
          value={search}
          onChangeText={setSearch}
          cursorColor={c.fg}
          selectionColor={c.ring}
          style={[parts.body, local.searchInput, { color: c.fg }]}
        />
      </View>
      <View style={local.head}>
        <Text accessibilityRole="header" style={[parts.small, local.headText, { color: c.label }]}>
          {archived ? 'Archived Customers' : 'By name'}
        </Text>
        {anyArchived ? (
          <SmallButton label={archived ? 'Show current' : 'Show archived'} onPress={() => setArchived(!archived)} />
        ) : null}
      </View>
      {shown.length > 0 ? (
        <List>
          {shown.map((x, i) => (
            <Row
              key={x.id}
              first={i === 0}
              title={x.name}
              subtitle={[x.firstSite, x.followUpDue ? 'Follow up due' : ''].filter(Boolean).join(' · ') || undefined}
              onPress={() => nav.open({ screen: 'customer', id: x.id })}
            />
          ))}
        </List>
      ) : (
        <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.label }]}>
          {search.trim() !== ''
            ? `No Customer matches "${search.trim()}". Check the spelling, or search by phone number.`
            : archived
              ? 'No archived Customers.'
              : 'Every Customer is archived. Tap Show archived to see them, or New to add one.'}
        </Text>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  gap: { gap: space.s4 },
  search: {
    minHeight: size.touch,
    borderRadius: radius.r,
    borderWidth: size.hairline,
    paddingHorizontal: space.s3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  searchInput: { flex: 1, paddingVertical: space.s2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s2 },
  headText: { fontWeight: '600', flexShrink: 1 },
});
