import { getSetting } from './settings.ts';

/**
 * Transparent order pricing. Every amount is an explicit line with who pays it.
 * Agricultural produce itself is shown without tax; tax is applied only to
 * platform fees (when fees are configured). Nothing is hidden in the unit price.
 */
export interface Charge { label: string; amount: number; payer: 'buyer' | 'farmer'; kind: 'packaging' | 'transport' | 'storage' | 'handling' | 'other' }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function breakdown(quantity: number, pricePerUnit: number, charges: Charge[]) {
  const productValue = r2(quantity * pricePerUnit);
  const buyerFeePct = Number(getSetting('platform_fee_buyer_pct')) || 0;
  const farmerFeePct = Number(getSetting('platform_fee_farmer_pct')) || 0;
  const taxPct = Number(getSetting('tax_on_fees_pct')) || 0;
  const buyerFee = r2((productValue * buyerFeePct) / 100);
  const farmerFee = r2((productValue * farmerFeePct) / 100);
  const buyerFeeTax = r2((buyerFee * taxPct) / 100);
  const farmerFeeTax = r2((farmerFee * taxPct) / 100);
  const sum = (payer: 'buyer' | 'farmer') => r2(charges.filter((c) => c.payer === payer).reduce((s, c) => s + c.amount, 0));
  const buyerCharges = sum('buyer');
  const farmerCharges = sum('farmer');
  const byKind = (k: Charge['kind']) => r2(charges.filter((c) => c.kind === k).reduce((s, c) => s + c.amount, 0));
  const buyerPayable = r2(productValue + buyerCharges + buyerFee + buyerFeeTax);
  const farmerNet = r2(productValue - farmerCharges - farmerFee - farmerFeeTax);
  return {
    product_value: productValue,
    packaging: byKind('packaging'),
    transport: byKind('transport'),
    storage: byKind('storage'),
    handling: byKind('handling'),
    other_charges: byKind('other'),
    charges,
    platform_fee_buyer: buyerFee,
    platform_fee_farmer: farmerFee,
    platform_fee_pct: { buyer: buyerFeePct, farmer: farmerFeePct },
    tax_on_fees: r2(buyerFeeTax + farmerFeeTax),
    tax_note: 'No tax is added to the produce price. Tax applies only to platform fees, if any. Parties are responsible for their own tax obligations.',
    buyer_payable: buyerPayable,
    farmer_net: farmerNet,
  };
}

/** Final settlement after delivery, based on the quantity actually accepted. */
export function settlement(acceptedQty: number, pricePerUnit: number, charges: Charge[]) {
  return breakdown(acceptedQty, pricePerUnit, charges).farmer_net;
}

export const haversineKm = (a: number, b: number, c: number, d: number) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

export const roadKm = (a: number, b: number, c: number, d: number) =>
  Math.round(haversineKm(a, b, c, d) * Number(getSetting('road_distance_factor')) * 10) / 10;
