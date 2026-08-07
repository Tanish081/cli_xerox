import type { PrintSpec } from "./types";

// Shop's per-page print pricing. Adjust to match the owner's actual rates.
const PRICE_PER_PAGE_BW = 2;
const PRICE_PER_PAGE_COLOR = 8;
const DUPLEX_DISCOUNT_MULTIPLIER = 0.85; // duplex saves paper, so a small discount
const BINDING_PRICE: Record<PrintSpec["binding"], number> = {
  none: 0,
  staple: 5,
  spiral: 30,
};

export function priceForPrintSpec(spec: PrintSpec): number {
  const perPage = spec.color === "color" ? PRICE_PER_PAGE_COLOR : PRICE_PER_PAGE_BW;
  const sheets = spec.duplex ? Math.ceil(spec.page_count / 2) : spec.page_count;
  const multiplier = spec.duplex ? DUPLEX_DISCOUNT_MULTIPLIER : 1;
  const printCost = perPage * sheets * multiplier * spec.copies;
  const bindingCost = BINDING_PRICE[spec.binding] * spec.copies;
  return Math.round((printCost + bindingCost) * 100) / 100;
}
