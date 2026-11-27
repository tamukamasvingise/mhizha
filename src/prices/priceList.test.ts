import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "../db";
import { nodePlatform } from "../db/node";
import { addPriceItem, deletePriceItem, editPriceItem, priceItems, readPriceItem, undeletePriceItem } from "./priceList";

let n = 0;
const random = (size: number) => {
  const b = new Uint8Array(size);
  let c = ++n;
  for (let i = size - 1; i >= 0; i--) {
    b[i] = c % 256;
    c = Math.floor(c / 256);
  }
  return b;
};

let db: Db;
beforeEach(() => {
  const opened = openDatabase({ platform: nodePlatform(), appVersion: "1.0.0", random });
  if (!opened.ok) throw new Error(opened.problem);
  db = opened.db;
});

const labour = { name: "Labour", unit: "day", unitPrice: "45" };

describe("Price list", () => {
  it("starts empty", () => {
    expect(priceItems(db)).toEqual([]);
  });

  it("keeps an added item's name, unit and unit price in whole cents", () => {
    const r = addPriceItem(db, { name: " 15mm copper pipe ", unit: "m", unitPrice: "6.20" });
    expect(r.ok).toBe(true);
    expect(priceItems(db)).toEqual([
      { id: r.ok ? r.id : "", name: "15mm copper pipe", unit: "m", unitPrice: 620 },
    ]);
  });

  it("lists items by name, ignoring case", () => {
    addPriceItem(db, { name: "geyser 150L", unit: "", unitPrice: "285" });
    addPriceItem(db, labour);
    addPriceItem(db, { name: "Cement, 50kg bag", unit: "bag", unitPrice: "11" });
    expect(priceItems(db).map((i) => i.name)).toEqual(["Cement, 50kg bag", "geyser 150L", "Labour"]);
  });

  it("allows a zero price and an empty unit", () => {
    const r = addPriceItem(db, { name: "Site visit", unit: "", unitPrice: "0" });
    expect(r.ok).toBe(true);
    expect(priceItems(db)[0]).toMatchObject({ unit: "", unitPrice: 0 });
  });

  it("says what is wrong when the name or price will not do, and saves nothing", () => {
    const r = addPriceItem(db, { name: "  ", unit: "day", unitPrice: "-3" });
    expect(r).toEqual({
      ok: false,
      errors: {
        name: "Enter the item's name.",
        unitPrice: "Enter an amount in US dollars, like 45 or 12.50.",
      },
    });
    expect(priceItems(db)).toEqual([]);
  });

  it("changes an item", () => {
    const r = addPriceItem(db, labour);
    if (!r.ok) throw new Error();
    expect(editPriceItem(db, r.id, { name: "Labour, per day", unit: "day", unitPrice: "50" })).toEqual({
      ok: true,
      id: r.id,
    });
    expect(readPriceItem(db, r.id)).toEqual({ id: r.id, name: "Labour, per day", unit: "day", unitPrice: 5000 });
  });

  it("leaves an item as it was when a change will not do", () => {
    const r = addPriceItem(db, labour);
    if (!r.ok) throw new Error();
    expect(editPriceItem(db, r.id, { ...labour, unitPrice: "4.555" }).ok).toBe(false);
    expect(readPriceItem(db, r.id)?.unitPrice).toBe(4500);
  });

  it("deletes an item from the list but keeps a marker, and can bring it back", () => {
    const a = addPriceItem(db, labour);
    const b = addPriceItem(db, { name: "Double socket outlet", unit: "", unitPrice: "8.50" });
    if (!a.ok || !b.ok) throw new Error();
    deletePriceItem(db, a.id);
    expect(priceItems(db).map((i) => i.id)).toEqual([b.id]);
    expect(readPriceItem(db, a.id)).toBeUndefined();
    expect(db.get("SELECT name, deleted_at FROM price_list_item WHERE id = ?", [a.id])).toMatchObject({
      name: "Labour",
      deleted_at: expect.any(String),
    });
    undeletePriceItem(db, a.id);
    expect(priceItems(db).map((i) => i.name)).toEqual(["Double socket outlet", "Labour"]);
  });
});
