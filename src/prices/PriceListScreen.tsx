import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatUsd } from '../core';
import { useDb } from '../shell/Records';
import { Button, EmptyState, Sheet, SubTopBar, Tappable, Toast, styles as parts } from '../ui/parts';
import { TextField } from '../ui/fields';
import { useColours } from '../ui/theme';
import { lineHeight, radius, size, space, type } from '../ui/tokens';
import {
  addPriceItem,
  deletePriceItem,
  editPriceItem,
  priceItems,
  undeletePriceItem,
  type PriceItem,
  type PriceItemErrors,
  type PriceItemInput,
} from './priceList';

// The Price list, a sub screen of Settings: the saved items that fill in
// Document lines. Tap an item to change or delete it.

type Editing = { id: string | null; input: PriceItemInput; errors: PriceItemErrors };
type Notice = { message: string; undoId?: string };

const blank: PriceItemInput = { name: '', unit: '', unitPrice: '' };
const TOAST_MS = 5000;

export function PriceListScreen({ onBack }: { onBack: () => void }) {
  const c = useColours();
  const db = useDb();
  const [items, setItems] = useState<PriceItem[]>(() => priceItems(db));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const reload = () => setItems(priceItems(db));
  const startAdd = () => setEditing({ id: null, input: blank, errors: {} });
  const startEdit = (item: PriceItem) =>
    setEditing({
      id: item.id,
      input: { name: item.name, unit: item.unit, unitPrice: (item.unitPrice / 100).toFixed(2) },
      errors: {},
    });

  const save = () => {
    if (!editing) return;
    const r = editing.id ? editPriceItem(db, editing.id, editing.input) : addPriceItem(db, editing.input);
    if (!r.ok) return setEditing({ ...editing, errors: r.errors });
    setEditing(null);
    reload();
    setNotice({ message: `Saved ${editing.input.name.trim()}` });
  };

  const remove = () => {
    if (!editing?.id) return;
    deletePriceItem(db, editing.id);
    setEditing(null);
    reload();
    setNotice({ message: `Deleted ${editing.input.name.trim()}`, undoId: editing.id });
  };

  const undo = (id: string) => {
    undeletePriceItem(db, id);
    reload();
    setNotice({ message: 'Put back on the Price list' });
  };

  const set = (field: keyof PriceItemInput) => (text: string) =>
    editing && setEditing({ ...editing, input: { ...editing.input, [field]: text } });

  return (
    <View style={local.root}>
      <SubTopBar title="Price list" onBack={onBack} />
      <ScrollView contentContainerStyle={local.main}>
        {items.length === 0 ? (
          <EmptyState
            title="No items yet"
            body="Save the work and materials you charge for often, like labour per day or a bag of cement. They fill in Document lines."
          />
        ) : (
          <>
            <Text style={[parts.body, { color: c.label }]}>
              Saved items fill in Document lines. Prices can still be changed on each Document. Not stock.
            </Text>
            <View style={[local.list, { borderColor: c.line, backgroundColor: c.surface }]}>
              {items.map((item, i) => (
                <Tappable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${priceText(item)}`}
                  accessibilityHint="Change or delete this item"
                  onPress={() => startEdit(item)}
                  style={({ pressed }) => [
                    local.row,
                    i > 0 && { borderTopWidth: size.hairline, borderTopColor: c.line },
                    pressed && { backgroundColor: c.tint },
                  ]}
                >
                  <Text style={[local.rowTitle, { color: c.fg }]}>{item.name}</Text>
                  <View style={local.price}>
                    <Text style={[local.amount, { color: c.fg }]}>{formatUsd(item.unitPrice)}</Text>
                    {item.unit ? (
                      <Text style={[parts.small, { color: c.label }]}>{`per ${item.unit}`}</Text>
                    ) : null}
                  </View>
                </Tappable>
              ))}
            </View>
          </>
        )}
        <Button label="Add an item" primary onPress={startAdd} />
      </ScrollView>
      {notice ? (
        <Toast
          message={notice.message}
          action={notice.undoId ? { label: 'Undo', onPress: () => undo(notice.undoId!) } : undefined}
        />
      ) : null}
      <Sheet visible={editing !== null} title={editing?.id ? 'Change item' : 'Add an item'} onClose={() => setEditing(null)}>
        {editing ? (
          <View style={local.form}>
            <TextField
              label="Name"
              value={editing.input.name}
              onChange={set('name')}
              error={editing.errors.name}
            />
            <TextField
              label="Unit (optional)"
              hint="Like day, m or bag."
              value={editing.input.unit}
              onChange={set('unit')}
            />
            <TextField
              label="Unit price (US$)"
              value={editing.input.unitPrice}
              onChange={set('unitPrice')}
              error={editing.errors.unitPrice}
              keyboardType="decimal-pad"
            />
            <Button label={editing.id ? 'Save changes' : 'Add to Price list'} primary onPress={save} />
            {editing.id ? <Button label="Delete item" onPress={remove} /> : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function priceText(item: PriceItem): string {
  return item.unit ? `${formatUsd(item.unitPrice)} per ${item.unit}` : formatUsd(item.unitPrice);
}

const local = StyleSheet.create({
  root: { flex: 1 },
  main: { padding: space.s4, paddingBottom: space.s8 + size.touch + space.s4, gap: space.s4 },
  list: { borderWidth: size.hairline, borderRadius: radius.r, overflow: 'hidden' },
  row: {
    minHeight: size.topBar,
    padding: space.s3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
  },
  rowTitle: { flex: 1, fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  price: { alignItems: 'flex-end', flexShrink: 0 },
  amount: {
    fontSize: type.m,
    lineHeight: lineHeight(type.m),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  form: { gap: space.s3 },
});
