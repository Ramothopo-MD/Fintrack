const crypto = require("crypto");
const stringSimilarity = require("string-similarity");

/**
 * Normalize OCR text to reduce noise.
 */
function normalizeOcr(text) {
  return (text || "")
    .replace(/\s+/g, " ")   // collapse multiple spaces/newlines
    .trim()
    .toLowerCase();
}

/**
 * Generate a hash (SHA-256) for fast exact duplicate detection.
 */
function hashOcr(text) {
  return crypto.createHash("sha256").update(normalizeOcr(text)).digest("hex");
}

/**
 * Check if a new OCR text is a duplicate compared to existing ones.
 *
 * @param {String} newOcrText - The OCR text of the new receipt
 * @param {Array} existingOcrs - List of existing OCR entries (with {ocr_text, ocr_hash})
 * @param {Number} [similarityThreshold=0.9] - Similarity threshold for fuzzy match
 *
 * @returns {Object} - { duplicate: Boolean, reason: String, existing: Object|null }
 */
function findDuplicateOcr(newOcrText, existingOcrs, similarityThreshold = 0.9) {
  const normalizedNew = normalizeOcr(newOcrText);
  const newHash = hashOcr(newOcrText);

  // 1. Exact hash check
  for (const record of existingOcrs) {
    if (record.ocr_hash === newHash) {
      return {
        duplicate: true,
        reason: "The receipt appears to be an exact duplicate to another in the database.",
        existing: record
      };
    }
  }

  // 2. Fuzzy similarity check
  for (const record of existingOcrs) {
    const similarity = stringSimilarity.compareTwoStrings(
      normalizedNew,
      normalizeOcr(record.ocr_text)
    );
    if (similarity >= similarityThreshold) {
      return {
        duplicate: true,
        reason: `Similar OCR match (${Math.round(similarity * 100)}%)`,
        existing: record
      };
    }
  }

  return { duplicate: false, reason: null, existing: null };
}

module.exports = { normalizeOcr, hashOcr, findDuplicateOcr };
