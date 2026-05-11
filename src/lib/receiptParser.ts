import { GroceryCategory } from './supabase';

export interface ParsedReceiptItem {
  name: string;
  price: number;
  category: GroceryCategory | 'Other';
}

// ─── Skip patterns ────────────────────────────────────────────────────────────
// Lines that are not grocery items

const SKIP_PATTERN = /\b(tax|hst|gst|pst|vat|subtotal|sub\s*total|total|balance|change|cash|debit|credit|visa|mastercard|amex|discover|card|payment|paid|approved|auth|account|savings?|coupon|discount|promo|loyalty|reward|points?|member|club|sale|item count|items?:|qty|quantity|bag\s*fee|deposit|bottle|refund|void|cancel)\b/i;

const STORE_HEADER_PATTERN = /^(store|branch|tel|phone|fax|www\.|http|receipt|invoice|order|transaction|cashier|operator|thank|welcome|visit|date|time|day|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|^\s*#\d)/i;

// Lines that are purely numeric/codes with no readable name
const CODE_ONLY_PATTERN = /^\s*[\d\s\-#*]+\s*$/;

// ─── Price extraction ─────────────────────────────────────────────────────────

// Matches prices like 3.49, $3.49, 3,49 (European), $1,234.56
const PRICE_PATTERN = /\$?\s*(\d{1,4}[.,]\d{2})\b/g;

function extractPrice(segment: string): number | null {
  const matches = [...segment.matchAll(PRICE_PATTERN)];
  if (matches.length === 0) return null;
  // Take the last price on a line (most receipt formats put price at the end)
  const raw = matches[matches.length - 1][1].replace(',', '.');
  const val = parseFloat(raw);
  // Sanity: grocery items range $0.01 – $999
  return val > 0 && val < 1000 ? val : null;
}

// ─── Name cleaning ────────────────────────────────────────────────────────────

const PRICE_STRIP = /\$?\s*\d{1,4}[.,]\d{2}\b/g;
const QTY_PREFIX = /^\d+\s*[@x*]\s*/i;           // "2x MILK" or "3 @ EGGS"
const WEIGHT_SUFFIX = /\s+\d+(\.\d+)?\s*(kg|lb|lbs|oz|g|ml|l)\b/i;
const BARCODE_PREFIX = /^\s*[\d]{4,}\s+/;         // leading barcodes
const TRAILING_CODES = /\s+[A-Z0-9]{1,3}$/;       // trailing codes like " N" " T" " F"
const MULTI_SPACE = /\s{2,}/g;

function cleanName(raw: string): string {
  return raw
    .replace(PRICE_STRIP, '')
    .replace(BARCODE_PREFIX, '')
    .replace(QTY_PREFIX, '')
    .replace(WEIGHT_SUFFIX, '')
    .replace(TRAILING_CODES, '')
    .replace(MULTI_SPACE, ' ')
    .trim()
    // Title-case: "ORGANIC MILK" → "Organic Milk"
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    // Keep common abbreviations uppercase
    .replace(/\b(Oj|Bb|Pbj|Pb)\b/g, (m) => m.toUpperCase());
}

// ─── Auto-categorisation ─────────────────────────────────────────────────────

type CategoryRule = { pattern: RegExp; category: GroceryCategory };

const CATEGORY_RULES: CategoryRule[] = [
  // Produce
  { pattern: /\b(apple|banana|orange|grape|berry|berries|lettuce|spinach|kale|broccoli|carrot|tomato|potato|onion|garlic|pepper|cucumber|zucchini|squash|celery|avocado|lemon|lime|mango|pineapple|strawberr|blueberr|raspberr|peach|pear|plum|melon|watermelon|cabbage|cauliflower|mushroom|corn|pea|bean|asparagus|artichoke|leek|ginger|herb|basil|cilantro|parsley|salad|salsa|fresh|veggie|vegetable|fruit)\b/i, category: 'Produce' },
  // Dairy
  { pattern: /\b(milk|cheese|yogurt|yoghurt|butter|cream|sour cream|cottage|ricotta|mozzarella|cheddar|parmesan|gouda|brie|feta|ice cream|gelato|creamer|half.half|whipping|eggs?|egg)\b/i, category: 'Dairy' },
  // Meat
  { pattern: /\b(chicken|beef|pork|turkey|lamb|veal|steak|ground|sausage|bacon|ham|salami|pepperoni|deli|slice|roast|rib|chop|wing|breast|thigh|drumstick|brisket|tenderloin|loin|patties?|burger|hotdog|hot dog|meatball|pulled|shrimp|prawn|scallop|crab|lobster|tilapia|salmon|tuna|cod|halibut|mahi|catfish|fish|seafood)\b/i, category: 'Meat' },
  // Override seafood after meat sweep
  { pattern: /\b(shrimp|prawn|scallop|crab|lobster|tilapia|salmon|tuna|cod|halibut|mahi|catfish|fish|seafood|sushi|sashimi)\b/i, category: 'Seafood' },
  // Bakery
  { pattern: /\b(bread|bun|roll|bagel|muffin|croissant|baguette|sourdough|rye|wheat|white bread|pita|tortilla|wrap|naan|cake|cookie|donut|doughnut|pastry|danish|scone|waffle|pancake|biscuit)\b/i, category: 'Bakery' },
  // Frozen
  { pattern: /\b(frozen|freeze|ice cream|gelato|popsicle|sorbet|pizza|waffles|nuggets|fries?|edamame|pierogi|burrito)\b/i, category: 'Frozen' },
  // Beverages
  { pattern: /\b(juice|water|soda|pop|cola|coffee|tea|latte|espresso|cappuccino|drink|beverage|beer|wine|cider|kombucha|smoothie|shake|lemonade|gatorade|powerade|energy drink|sparkling)\b/i, category: 'Beverages' },
  // Snacks
  { pattern: /\b(chip|crisp|popcorn|pretzel|cracker|granola|bar|snack|trail mix|nut|almond|cashew|peanut|pistachio|sunflower|candy|chocolate|gummy|licorice|marshmallow|pudding|jello|rice cake|protein bar|cereal bar)\b/i, category: 'Snacks' },
  // Pantry
  { pattern: /\b(pasta|rice|flour|sugar|salt|pepper|spice|sauce|ketchup|mustard|mayo|mayonnaise|dressing|vinegar|oil|olive oil|soy sauce|hot sauce|bbq|broth|stock|soup|canned|can of|beans?|lentil|chickpea|quinoa|oat|oatmeal|cereal|granola|syrup|honey|jam|jelly|peanut butter|nut butter|baking|powder|soda|yeast|cocoa|chocolate chips|coconut|dried|raisin|date|apricot|cranberr|trail|nuts?|seed)\b/i, category: 'Pantry' },
  // Personal Care
  { pattern: /\b(shampoo|conditioner|soap|body wash|lotion|moisturizer|deodorant|toothpaste|toothbrush|floss|razor|shaving|sunscreen|sunblock|makeup|mascara|lipstick|foundation|blush|eyeliner|perfume|cologne|feminine|tampon|pad|liner|toilet paper|tissue|cotton|q.tip|band.aid|bandage|vitamin|supplement|medicine|tylenol|advil|ibuprofen)\b/i, category: 'Personal Care' },
  // Household
  { pattern: /\b(detergent|laundry|dish|dishwasher|cleaner|bleach|sponge|scrubber|mop|broom|vacuum|trash|garbage|bag|foil|wrap|paper towel|napkin|towel|cloth|wipe|disinfect|spray|candle|battery|light bulb|bulb|filter)\b/i, category: 'Household' },
  // Baby
  { pattern: /\b(baby|infant|toddler|diaper|nappy|formula|wipe|pacifier|bottle|bib|onesie|pampers|huggies)\b/i, category: 'Baby' },
  // Pet
  { pattern: /\b(dog|cat|pet|kibble|treat|litter|paws?|fido|whiskas|purina|friskies)\b/i, category: 'Pet' },
];

export function categorise(name: string): GroceryCategory | 'Other' {
  // Walk rules in order; last matching seafood rule overrides meat
  let result: GroceryCategory | 'Other' = 'Other';
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) result = rule.category;
  }
  return result;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parses raw receipt text into structured grocery items.
 *
 * Strategy:
 * 1. Split into lines
 * 2. Skip header/footer/non-item lines
 * 3. For each candidate line, extract the last price and the name segment
 * 4. Clean the name and auto-categorise
 */
export function parseReceiptText(text: string): ParsedReceiptItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ParsedReceiptItem[] = [];
  const seenNames = new Set<string>();

  for (const line of lines) {
    // Skip obvious non-item lines
    if (SKIP_PATTERN.test(line)) continue;
    if (STORE_HEADER_PATTERN.test(line)) continue;
    if (CODE_ONLY_PATTERN.test(line)) continue;

    const price = extractPrice(line);
    if (price === null) continue;  // no price → not a line-item

    // Name is everything before the first price
    const priceIdx = line.search(PRICE_PATTERN);
    const rawName = priceIdx > 0 ? line.slice(0, priceIdx) : line;
    const name = cleanName(rawName);

    if (name.length < 2) continue;   // too short to be meaningful
    if (/^\d+$/.test(name)) continue; // purely numeric

    // Deduplicate (some receipts repeat items with sub-lines)
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const category = categorise(name);
    results.push({ name, price, category });
  }

  return results;
}
