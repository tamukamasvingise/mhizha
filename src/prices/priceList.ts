// The Price list (spec section 5): saved items with a name, a unit and a unit
// price in whole cents that fill in Document lines. Not stock. A delete leaves
// a marker; nothing is erased (spec section 12).
import { parseUsd, type Cents } from "../core";
import type { Db, Row } from "../db";

export type PriceItem = { id: string; name: string; unit: string; unitPrice: Cents };

/** What the User typed. */
export type PriceItemInput = { name: string; unit: string; unitPrice: string };

export type PriceItemErrors = Partial<Record<keyof PriceItemInput, string>>;

export type SaveResult = { ok: true; id: string } | { ok: false; errors: PriceItemErrors };

const TABLE = "price_list_item";
const COLUMNS = "id, name, unit, unit_price";

function toItem(r: Row): PriceItem {
  return { id: String(r.id), name: String(r.name), unit: String(r.unit), unitPrice: Number(r.unit_price) };
}

/** The items not deleted, by name. */
export function priceItems(db: Db): PriceItem[] {
  return db
    .all(`SELECT ${COLUMNS} FROM ${TABLE} WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, id`)
    .map(toItem);
}

/** One item, unless it is deleted or was never there. */
export function readPriceItem(db: Db, id: string): PriceItem | undefined {
  const r = db.get(`SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ? AND deleted_at IS NULL`, [id]);
  return r ? toItem(r) : undefined;
}

function check(input: PriceItemInput): { ok: true; values: Record<string, string | number> } | { ok: false; errors: PriceItemErrors } {
  const errors: PriceItemErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Enter the item's name.";
  const price = parseUsd(input.unitPrice);
  if (!price.ok) errors.unitPrice = price.message;
  if (!price.ok || errors.name) return { ok: false, errors };
  return { ok: true, values: { name, unit: input.unit.trim(), unit_price: price.cents } };
}

export function addPriceItem(db: Db, input: PriceItemInput): SaveResult {
  const c = check(input);
  if (!c.ok) return c;
  return { ok: true, id: db.insert(TABLE, c.values) };
}

export function editPriceItem(db: Db, id: string, input: PriceItemInput): SaveResult {
  const c = check(input);
  if (!c.ok) return c;
  db.update(TABLE, id, c.values);
  return { ok: true, id };
}

/** Takes the item off the list. The record stays, marked deleted. */
export function deletePriceItem(db: Db, id: string): void {
  db.update(TABLE, id, { deleted_at: new Date().toISOString() });
}

/** Puts a deleted item back on the list (the Undo after a delete). */
export function undeletePriceItem(db: Db, id: string): void {
  db.update(TABLE, id, { deleted_at: null });
}
