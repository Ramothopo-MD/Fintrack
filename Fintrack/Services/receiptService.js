const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Preprocess OCR text to normalize patterns for better quantity detection
 */
function cleanOcrForQuantities(ocrText) {
  return ocrText
    .replace(/(\d+)\s*@\s*(\d+(\.\d{1,2})?)/g, "Qty:$1 Price:$2")   // "2 @ 10.00"
    .replace(/x\s?(\d+)/gi, "Qty:$1")                               // "x2"
    .replace(/(\d+)\s*x\s*(\d+(\.\d{1,2})?)/gi, "Qty:$1 Price:$2")  // "2x 10.00"
    .replace(/(\d+\.\d{2})\s+(\d+\.\d{2})/g, "$1 Total:$2")         // "16.99 101.94"
    .replace(/BONUS\s+BUY/gi, "DISCOUNT");
}

/**
 * Post-process GPT output to infer missing quantities
 */
function inferQuantities(items) {
  return items.map(item => {
    if (item.quantity === 1 && item.price && item.total) {
      const inferred = Math.round(item.total / item.price);
      if (inferred > 1) {
        return { ...item, quantity: inferred };
      }
    }
    return item;
  });
}

/**
 * Extract text from an image buffer using Sharp + Tesseract
 */
async function extractText(imageBuffer) {
  const processed = await sharp(imageBuffer)
    .rotate()
    .grayscale()
    .normalize()
    .resize({ width: 2000 })
    .threshold(150)
    .toFormat("png")
    .toBuffer();

  const { data: { text } } = await Tesseract.recognize(processed, "eng", {
    logger: () => {}
  });

  return text;
}

/**
 * Validate if OCR text looks like a receipt
 */
async function isReceiptText(ocrText) {
  if (!ocrText || ocrText.trim().length < 20) return false;

  const keywords = /(total|subtotal|cash|card|vat|change|receipt|invoice)/i;
  if (keywords.test(ocrText)) return true;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Answer only 'yes' or 'no'." },
      { role: "user", content: `Does this text look like a store receipt?\n\n${ocrText}` }
    ],
    temperature: 0
  });

  const answer = completion.choices[0].message.content.trim().toLowerCase();
  return answer === "yes";
}

/**
 * Parse OCR text into structured receipt info
 */
async function parseReceiptText(ocrText) {
  const cleanedOcr = cleanOcrForQuantities(ocrText);

  const valid = await isReceiptText(cleanedOcr);
  if (!valid) {
    throw new Error("Uploaded file does not appear to be a valid receipt.");
  }

  const prompt = `
You are a receipt parsing and currency conversion assistant.

Your task:
1. Parse the receipt OCR text and return only a valid JSON object following the schema.
2. Detect the original currency (USD, EUR, GBP, etc.) from symbols or context.
3. Convert **all amounts to South African Rands (ZAR)** using the most recent approximate exchange rates you know.
4. Include the detected currency and the conversion rate used.
5. Follow the schema exactly and ensure all numeric fields are converted to Rands.

Schema:
{
  "storeName": "string or null",
  "date": "YYYY-MM-DD or DD/MM/YY or null",
  "time": "HH:MM:SS or HH:MM am/pm or null",
  "paymentMethod": "CASH|CARD|EFT|MOBILE|VOUCHER|CHEQUE|BANK|UNKNOWN",
  "currencyDetected": "string or null",
  "conversionRateToZAR": number | null,
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "change": number | null,
  "items": [
    { 
      "name": "string", 
      "price": number, 
      "quantity": number, 
      "total": number | null,
      "category": "string | null"
    }
  ]
}

⚠️ Rules:
- Convert *every* price and total to ZAR before returning.
- Round all converted numbers to 2 decimal places.
- Default quantity = 1 if missing.
- Ignore lines like TOTAL, SUBTOTAL, CHANGE, ROUNDING.
- Infer item categories logically (Groceries, Beverages, Household, etc.)
- If currency cannot be detected, assume ZAR and conversion rate 1.0.

OCR TEXT:
---
${cleanedOcr}
---`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You convert OCR receipt text into strict JSON following the schema and convert all currency to ZAR." },
      { role: "user", content: prompt }
    ],
    temperature: 0.1
  });

  let parsed = JSON.parse(completion.choices[0].message.content);

  // ✅ Post-processing to ensure items are clean
  parsed.items = inferQuantities(parsed.items || []).map(item => ({
    ...item,
    category: item.category || "Uncategorized"
  }));

  return parsed;
}


module.exports = { extractText, parseReceiptText };
