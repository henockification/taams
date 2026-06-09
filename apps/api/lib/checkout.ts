export type CartItemInput = { productId: string; quantity: number };

/** Returns tax amount in dollars. */
export function calcVaTax(subtotalDollars: number, shippingState?: string) {
  if (!shippingState) return 0;
  if (shippingState.toUpperCase() !== 'VA') return 0;
  const rate = 0.053; // 5.3%
  return Number((subtotalDollars * rate).toFixed(2));
}
