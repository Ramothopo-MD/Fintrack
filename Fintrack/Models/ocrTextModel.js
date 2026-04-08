const pool = require("../Config/db");

const OcrTextModel = {
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ocr_texts (
        ocr_id INT AUTO_INCREMENT PRIMARY KEY,
        receipt_id INT NOT NULL,
        ocr_text LONGTEXT,
        ocr_hash CHAR(64), -- SHA-256 hash
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receipt_id) REFERENCES receipts(receipt_id) ON DELETE CASCADE
      )
    `);
  },

  async saveOcrText(receiptId, text, hash) {
    await pool.query(
      `INSERT INTO ocr_texts (receipt_id, ocr_text, ocr_hash)
       VALUES (?, ?, ?)`,
      [receiptId, text, hash]
    );
  },

  async getOcrByReceiptId(receiptId) {
    const [rows] = await pool.query(
      `SELECT * FROM ocr_texts WHERE receipt_id=?`,
      [receiptId]
    );
    return rows;
  },

  async getOcrByUser(userId) {
    const [rows] = await pool.query(
      `SELECT ocr_texts.* FROM ocr_texts
       JOIN receipts ON ocr_texts.receipt_id = receipts.receipt_id
       WHERE receipts.user_id=?`,
      [userId]
    );
    return rows;
  }
};

module.exports = OcrTextModel;
