/**
 * Crop-specific inspection parameters. These are the measurements an inspector
 * records; FARMDirect does NOT compute the grade from them and does not claim
 * that a grade is an official AGMARK/BIS certification. Inspectors assign the
 * grade label and must give reasons. Thresholds should be taken from the
 * applicable official specification or the buyer's contract.
 */
export interface Criterion { key: string; label: string; unit: string; hint?: string }

const COMMON: Criterion[] = [
  { key: 'moisture_pct', label: 'Moisture', unit: '%', hint: 'Measured with a moisture meter' },
  { key: 'foreign_matter_pct', label: 'Foreign matter (stones, chaff, dust)', unit: '%' },
];

const BY_CATEGORY: Record<string, Criterion[]> = {
  cereal: [...COMMON,
    { key: 'damaged_discoloured_pct', label: 'Damaged / discoloured grains', unit: '%' },
    { key: 'broken_pct', label: 'Broken grains', unit: '%' },
    { key: 'immature_shrivelled_pct', label: 'Immature / shrivelled grains', unit: '%' },
    { key: 'insect_damage_pct', label: 'Insect-damaged grains', unit: '%' }],
  pulse: [...COMMON,
    { key: 'damaged_pct', label: 'Damaged grains', unit: '%' },
    { key: 'shrivelled_pct', label: 'Shrivelled / immature', unit: '%' },
    { key: 'weevilled_pct', label: 'Weevilled grains', unit: '%' }],
  oilseed: [...COMMON,
    { key: 'damaged_pct', label: 'Damaged kernels / pods', unit: '%' },
    { key: 'shrivelled_pct', label: 'Shrivelled / immature', unit: '%' },
    { key: 'oil_content_pct', label: 'Oil content (if tested)', unit: '%' }],
  vegetable: [
    { key: 'size_uniformity', label: 'Size uniformity', unit: 'good / fair / poor' },
    { key: 'defects_pct', label: 'Damaged, bruised or diseased units', unit: '%' },
    { key: 'colour_maturity', label: 'Colour / maturity', unit: 'description' },
    { key: 'average_size', label: 'Average size or weight', unit: 'mm or g' }],
  fruit: [
    { key: 'size_uniformity', label: 'Size uniformity', unit: 'good / fair / poor' },
    { key: 'defects_pct', label: 'Damaged, bruised or diseased units', unit: '%' },
    { key: 'ripeness', label: 'Ripeness stage', unit: 'description' }],
  spice: [...COMMON,
    { key: 'damaged_discoloured_pct', label: 'Damaged / discoloured', unit: '%' },
    { key: 'colour', label: 'Colour', unit: 'description' }],
  cash: [...COMMON,
    { key: 'trash_pct', label: 'Trash content', unit: '%' },
    { key: 'staple_length_mm', label: 'Staple length (cotton)', unit: 'mm' }],
};

export function criteriaFor(category?: string | null): Criterion[] {
  return BY_CATEGORY[category ?? ''] ?? [...COMMON, { key: 'defects_pct', label: 'Damaged / defective share', unit: '%' }];
}

export const GRADE_NOTE = 'Recorded inspection by a FARMDirect-verified inspector. Not an official government certification.';
