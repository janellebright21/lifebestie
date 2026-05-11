import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GROCERY_CATEGORIES = [
  "Produce", "Dairy", "Meat", "Seafood", "Bakery", "Frozen",
  "Beverages", "Pantry", "Snacks", "Personal Care", "Household", "Baby", "Pet",
];

// ─── Receipt text parser (mirrors src/lib/receiptParser.ts) ──────────────────
// Keeping this in-function avoids cross-dependency between edge functions.

const SKIP_PATTERN = /\b(tax|hst|gst|pst|vat|subtotal|sub\s*total|total|balance|change|cash|debit|credit|visa|mastercard|amex|discover|card|payment|paid|approved|auth|account|savings?|coupon|discount|promo|loyalty|reward|points?|member|club|sale|item count|items?:|qty|quantity|bag\s*fee|deposit|bottle|refund|void|cancel)\b/i;
const STORE_HEADER_PATTERN = /^(store|branch|tel|phone|fax|www\.|http|receipt|invoice|order|transaction|cashier|operator|thank|welcome|visit|date|time|day|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|^\s*#\d)/i;
const CODE_ONLY_PATTERN = /^\s*[\d\s#-*]+\s*$/;
const PRICE_PATTERN = /\$?\s*(\d{1,4}[.,]\d{2})\b/g;
const PRICE_STRIP = /\$?\s*\d{1,4}[.,]\d{2}\b/g;
const QTY_PREFIX = /^\d+\s*[@x*]\s*/i;
const WEIGHT_SUFFIX = /\s+\d+(\.\d+)?\s*(kg|lb|lbs|oz|g|ml|l)\b/i;
const BARCODE_PREFIX = /^\s*[\d]{4,}\s+/;
const TRAILING_CODES = /\s+[A-Z0-9]{1,3}$/;

interface ParsedItem {
  name: string;
  price: number;
  category: string;
  confirmed: boolean;
}

type CategoryRule = { pattern: RegExp; category: string };

const CATEGORY_RULES: CategoryRule[] = [
  { pattern: /\b(apple|banana|orange|grape|berry|berries|lettuce|spinach|kale|broccoli|carrot|tomato|potato|onion|garlic|pepper|cucumber|zucchini|squash|celery|avocado|lemon|lime|mango|pineapple|strawberr|blueberr|raspberr|peach|pear|plum|melon|watermelon|cabbage|cauliflower|mushroom|corn|pea|bean|asparagus|artichoke|leek|ginger|herb|basil|cilantro|parsley|salad|salsa|fresh|veggie|vegetable|fruit)\b/i, category: "Produce" },
  { pattern: /\b(milk|cheese|yogurt|yoghurt|butter|cream|sour cream|cottage|ricotta|mozzarella|cheddar|parmesan|gouda|brie|feta|ice cream|gelato|creamer|half.half|whipping|eggs?|egg)\b/i, category: "Dairy" },
  { pattern: /\b(chicken|beef|pork|turkey|lamb|veal|steak|ground|sausage|bacon|ham|salami|pepperoni|deli|slice|roast|rib|chop|wing|breast|thigh|drumstick|brisket|tenderloin|loin|patties?|burger|hotdog|hot dog|meatball|pulled)\b/i, category: "Meat" },
  { pattern: /\b(shrimp|prawn|scallop|crab|lobster|tilapia|salmon|tuna|cod|halibut|mahi|catfish|fish|seafood|sushi|sashimi)\b/i, category: "Seafood" },
  { pattern: /\b(bread|bun|roll|bagel|muffin|croissant|baguette|sourdough|rye|wheat|white bread|pita|tortilla|wrap|naan|cake|cookie|donut|doughnut|pastry|danish|scone|waffle|pancake|biscuit)\b/i, category: "Bakery" },
  { pattern: /\b(frozen|freeze|ice cream|gelato|popsicle|sorbet|pizza|waffles|nuggets|fries?|edamame|pierogi|burrito)\b/i, category: "Frozen" },
  { pattern: /\b(juice|water|soda|pop|cola|coffee|tea|latte|espresso|cappuccino|drink|beverage|beer|wine|cider|kombucha|smoothie|shake|lemonade|gatorade|powerade|energy drink|sparkling)\b/i, category: "Beverages" },
  { pattern: /\b(chip|crisp|popcorn|pretzel|cracker|granola|bar|snack|trail mix|nut|almond|cashew|peanut|pistachio|sunflower|candy|chocolate|gummy|licorice|marshmallow|pudding|jello|rice cake|protein bar|cereal bar)\b/i, category: "Snacks" },
  { pattern: /\b(pasta|rice|flour|sugar|salt|pepper|spice|sauce|ketchup|mustard|mayo|mayonnaise|dressing|vinegar|oil|olive oil|soy sauce|hot sauce|bbq|broth|stock|soup|canned|can of|beans?|lentil|chickpea|quinoa|oat|oatmeal|cereal|granola|syrup|honey|jam|jelly|peanut butter|nut butter|baking|powder|soda|yeast|cocoa|chocolate chips|coconut|dried|raisin|date|apricot|cranberr|trail|nuts?|seed)\b/i, category: "Pantry" },
  { pattern: /\b(shampoo|conditioner|soap|body wash|lotion|moisturizer|deodorant|toothpaste|toothbrush|floss|razor|shaving|sunscreen|sunblock|makeup|mascara|lipstick|foundation|blush|eyeliner|perfume|cologne|feminine|tampon|pad|liner|toilet paper|tissue|cotton|q.tip|band.aid|bandage|vitamin|supplement|medicine|tylenol|advil|ibuprofen)\b/i, category: "Personal Care" },
  { pattern: /\b(detergent|laundry|dish|dishwasher|cleaner|bleach|sponge|scrubber|mop|broom|vacuum|trash|garbage|bag|foil|wrap|paper towel|napkin|towel|cloth|wipe|disinfect|spray|candle|battery|light bulb|bulb|filter)\b/i, category: "Household" },
  { pattern: /\b(baby|infant|toddler|diaper|nappy|formula|wipe|pacifier|bottle|bib|onesie|pampers|huggies)\b/i, category: "Baby" },
  { pattern: /\b(dog|cat|pet|kibble|treat|litter|paws?|fido|whiskas|purina|friskies)\b/i, category: "Pet" },
];

function categorise(name: string): string {
  let result = "Other";
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) result = rule.category;
  }
  return result;
}

function extractPrice(segment: string): number | null {
  const matches = [...segment.matchAll(new RegExp(PRICE_PATTERN.source, "g"))];
  if (matches.length === 0) return null;
  const raw = matches[matches.length - 1][1].replace(",", ".");
  const val = parseFloat(raw);
  return val > 0 && val < 1000 ? val : null;
}

function cleanName(raw: string): string {
  return raw
    .replace(new RegExp(PRICE_STRIP.source, "g"), "")
    .replace(BARCODE_PREFIX, "")
    .replace(QTY_PREFIX, "")
    .replace(WEIGHT_SUFFIX, "")
    .replace(TRAILING_CODES, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseReceiptText(text: string): ParsedItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: ParsedItem[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (SKIP_PATTERN.test(line)) continue;
    if (STORE_HEADER_PATTERN.test(line)) continue;
    if (CODE_ONLY_PATTERN.test(line)) continue;

    const price = extractPrice(line);
    if (price === null) continue;

    const priceIdx = line.search(new RegExp(PRICE_PATTERN.source));
    const rawName = priceIdx > 0 ? line.slice(0, priceIdx) : line;
    const name = cleanName(rawName);

    if (name.length < 2) continue;
    if (/^\d+$/.test(name)) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ name, price: Math.round(price * 100) / 100, category: categorise(name), confirmed: true });
  }

  return results;
}

// ─── Scan meta (store name, date, total) from receipt text ───────────────────

interface ReceiptMeta {
  store_name?: string;
  date?: string;
  total?: number;
}

function extractMeta(text: string): ReceiptMeta {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const meta: ReceiptMeta = {};

  // Store name: usually one of the first non-empty lines before items
  const candidateHeader = lines.slice(0, 4).find(
    (l) => l.length > 3 && !/\d{2}[/-]\d{2}/.test(l) && !/\btel\b|\bphone\b/i.test(l)
  );
  if (candidateHeader) meta.store_name = candidateHeader;

  // Date: look for common formats
  const dateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const year = y.length === 2 ? `20${y}` : y;
    const month = m.padStart(2, "0");
    const day = d.padStart(2, "0");
    const candidate = `${year}-${month}-${day}`;
    if (!isNaN(Date.parse(candidate))) meta.date = candidate;
  }

  // Total: last occurrence of "total" line
  const totalLine = [...text.matchAll(/\btotal\b[^\n]*?([\d,]+\.\d{2})/gi)].pop();
  if (totalLine) {
    const val = parseFloat(totalLine[1].replace(",", "."));
    if (val > 0) meta.total = val;
  }

  return meta;
}

// ─── Mock data (used when no API key is configured) ──────────────────────────

const MOCK_RECEIPT_TEXT = `FRESHMART GROCERY
01/15/2025

ORGANIC WHOLE MILK    4.99
FREE RANGE EGGS       5.49
BABY SPINACH          3.99
SOURDOUGH BREAD       5.49
PENNE PASTA           1.79
CHEDDAR CHEESE        6.29
ORANGE JUICE          4.49
GRANOLA BARS          3.99
OLIVE OIL             7.99
CHICKEN BREAST        8.49

SUBTOTAL             53.00
TAX                   2.65
TOTAL                55.65
`;

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg" } = body as {
      imageBase64?: string;
      mimeType?: string;
      rawText?: string;
    };

    // ── No API key: parse mock receipt text ──
    if (!apiKey) {
      const items = parseReceiptText(MOCK_RECEIPT_TEXT);
      const meta = extractMeta(MOCK_RECEIPT_TEXT);
      return new Response(
        JSON.stringify({ ...meta, items }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Pass 1: Ask Claude to transcribe the receipt as plain text ──
    // We ask only for the raw lines — no interpretation — so our parser handles structure.
    const transcribePrompt = `Transcribe this grocery receipt image as plain text, line by line.
Output ONLY the raw receipt text exactly as printed — store name, items, prices, totals.
Do NOT add any explanation, markdown, or commentary.
Preserve the original formatting: each item and its price on one line.
Example output:
FRESHMART GROCERY
01/15/2025
ORGANIC MILK    4.99
EGGS    5.49
SUBTOTAL    10.48
TAX    0.52
TOTAL    11.00`;

    const transcribeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 },
              },
              { type: "text", text: transcribePrompt },
            ],
          },
        ],
      }),
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.text();
      return new Response(
        JSON.stringify({ error: "AI transcription failed", detail: err }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcribeData = await transcribeRes.json();
    const rawText: string = transcribeData.content?.[0]?.text ?? "";

    // ── Pass 2: Deterministic parser + AI cleanup pass ──
    let parsedItems = parseReceiptText(rawText);
    const meta = extractMeta(rawText);

    // ── Pass 3 (optional): If parser returned few items, ask Claude to fill gaps ──
    // Claude corrects any OCR artefacts and catches items our regex missed.
    if (parsedItems.length < 3 && rawText.length > 50) {
      const categoriesStr = GROCERY_CATEGORIES.join(", ");
      const cleanupPrompt = `Here is transcribed receipt text:
<receipt>
${rawText}
</receipt>

Extract all grocery line items. Return ONLY a JSON array, no markdown, no explanation.
For each item: { "name": "Clean Name", "price": 0.00, "category": "one of: ${categoriesStr} or Other" }
Ignore: tax, subtotal, total, payment, change, savings, fees, store header/footer.
Normalize names to be human-readable (e.g. "ORG MLKWHL 1GL" → "Organic Whole Milk").`;

      const cleanupRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1500,
          messages: [{ role: "user", content: cleanupPrompt }],
        }),
      });

      if (cleanupRes.ok) {
        const cleanupData = await cleanupRes.json();
        const raw = (cleanupData.content?.[0]?.text ?? "[]")
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
        try {
          const aiItems = JSON.parse(raw);
          if (Array.isArray(aiItems) && aiItems.length > parsedItems.length) {
            parsedItems = aiItems
              .filter((i: { name?: string; price?: number }) => i.name && typeof i.price === "number" && i.price > 0)
              .map((i: { name: string; price: number; category?: string }) => ({
                name: String(i.name).trim(),
                price: Math.round(Number(i.price) * 100) / 100,
                category: GROCERY_CATEGORIES.includes(i.category ?? "") ? i.category : categorise(i.name),
                confirmed: true,
              }));
          }
        } catch { /* keep parsedItems from pass 2 */ }
      }
    }

    return new Response(
      JSON.stringify({ ...meta, items: parsedItems }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
