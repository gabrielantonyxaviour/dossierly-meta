/**
 * Creates the three PLN one-time products (VAT included) in Dodo TEST mode and prints their ids.
 * Usage: DODO_PAYMENTS_API_KEY=... npx tsx scripts/dodo-setup-products.ts
 * Refuses live mode on purpose; create the live products by hand in the dashboard with the same prices.
 * Dodo's request shape was taken from its docs and has not been run against the API yet.
 */
const key = process.env.DODO_PAYMENTS_API_KEY;
if (!key) throw new Error("Set DODO_PAYMENTS_API_KEY (a TEST mode key)");

const products = [
  { env: "DODO_PRODUCT_ONE_CASE", name: "Dossierly — One case", grosz: 19_900 },
  { env: "DODO_PRODUCT_ONE_CASE_FOUNDING", name: "Dossierly — One case (founding)", grosz: 9_900 },
  { env: "DODO_PRODUCT_HOUSEHOLD_YEAR", name: "Dossierly — Household year", grosz: 39_900 },
];

for (const p of products) {
  const res = await fetch("https://test.dodopayments.com/products", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: p.name,
      price: { type: "one_time_price", currency: "PLN", price: p.grosz, discount: 0, purchasing_power_parity: false, tax_inclusive: true },
      tax_category: "digital_products",
    }),
  });
  const body = (await res.json()) as { product_id?: string };
  process.stdout.write(`${p.env}=${res.ok ? body.product_id : `FAILED ${res.status}`}\n`);
}

export {};
