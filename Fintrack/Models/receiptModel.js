const pool = require("../Config/db");

const ReceiptModel = {
  /* ============================================================
     🧱 TABLE CREATION
  ============================================================ */
  async createTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        receipt_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        store_name VARCHAR(100) DEFAULT 'Unknown Store',
        date DATE,
        time TIME,
        payment_method ENUM('CASH','CARD','EFT','MOBILE','VOUCHER','CHEQUE','BANK','UNKNOWN') DEFAULT 'UNKNOWN',
        subtotal DECIMAL(10,2),
        tax DECIMAL(10,2),
        total DECIMAL(10,2),
        change_amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS receipt_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        receipt_id INT,
        name VARCHAR(255),
        price DECIMAL(10,2),
        category VARCHAR(100),
        quantity INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receipt_id) REFERENCES receipts(receipt_id) ON DELETE CASCADE
      )
    `);

    console.log("✅ receipts + receipt_items tables ready");
  },

  /* ============================================================
     💾 SAVE RECEIPT
  ============================================================ */
  async saveReceipt(receipt, userId) {
    if (!userId) {
      throw new Error("Missing user_id: you must be logged in to save a receipt.");
    }

    // Prevent duplicates
    const [rows] = await pool.query(
      `SELECT * FROM receipts 
       WHERE user_id = ? AND store_name = ? AND date = ? AND total = ?`,
      [
        userId,
        receipt.storeName ?? "Unknown Store",
        receipt.date ?? null,
        receipt.total ?? null
      ]
    );

    if (rows.length > 0) {
      throw new Error(
        `Duplicate receipt: ${rows[0].store_name}, ${rows[0].date}, Total R${rows[0].total}`
      );
    }

    // Insert new receipt
    const [result] = await pool.query(
      `INSERT INTO receipts
         (user_id, store_name, date, time, payment_method, subtotal, tax, total, change_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        receipt.storeName ?? "Unknown Store",
        receipt.date ?? null,
        receipt.time ?? null,
        receipt.paymentMethod ?? "UNKNOWN",
        receipt.subtotal ?? null,
        receipt.tax ?? null,
        receipt.total ?? null,
        receipt.change ?? null
      ]
    );

    return result.insertId;
  },

  /* ============================================================
     📋 GET ALL RECEIPTS (ADMIN OR GLOBAL)
  ============================================================ */
  async getAllReceipts() {
    const [rows] = await pool.query(
      "SELECT * FROM receipts ORDER BY date DESC, created_at DESC"
    );
    return rows;
  },

  /* ============================================================
     🧾 GET ALL RECEIPTS + ITEMS (BY USER)
  ============================================================ */
  async getAllByUserWithItems(userId) {
    const [rows] = await pool.query(
      `
      SELECT r.*, i.item_id, i.name AS item_name, i.price AS item_price, 
             i.quantity AS item_quantity, i.category AS item_category
      FROM receipts r
      LEFT JOIN receipt_items i ON r.receipt_id = i.receipt_id
      WHERE r.user_id = ?
      ORDER BY r.date DESC, r.created_at DESC
      `,
      [userId]
    );

    // Group receipts with their items
    const receiptsMap = new Map();

    for (const row of rows) {
      if (!receiptsMap.has(row.receipt_id)) {
        receiptsMap.set(row.receipt_id, {
          receipt_id: row.receipt_id,
          user_id: row.user_id,
          store_name: row.store_name,
          date: row.date,
          time: row.time,
          payment_method: row.payment_method,
          subtotal: row.subtotal,
          tax: row.tax,
          total: row.total,
          change_amount: row.change_amount,
          created_at: row.created_at,
          items: []
        });
      }

      if (row.item_id) {
        receiptsMap.get(row.receipt_id).items.push({
          item_id: row.item_id,
          name: row.item_name,
          price: row.item_price,
          quantity: row.item_quantity,
          category: row.item_category
        });
      }
    }

    return Array.from(receiptsMap.values());
  },

  /* ============================================================
     🔍 GET RECEIPT BY ID
  ============================================================ */
  async getReceiptById(id) {
    const [receipts] = await pool.query(
      "SELECT * FROM receipts WHERE receipt_id = ?",
      [id]
    );
    return receipts.length ? receipts[0] : null;
  },

  /* ============================================================
     ✏️ UPDATE RECEIPT
  ============================================================ */
  async updateReceipt(id, data) {
    await pool.query(
      `UPDATE receipts
       SET store_name=?, date=?, time=?, payment_method=?, subtotal=?, tax=?, total=?, change_amount=?
       WHERE receipt_id=?`,
      [
        data.store_name ?? data.storeName ?? null,
        data.date ?? null,
        data.time ?? null,
        data.payment_method ?? data.paymentMethod ?? "UNKNOWN",
        data.subtotal ?? null,
        data.tax ?? null,
        data.total ?? null,
        data.change ?? null,
        id
      ]
    );

    const [rows] = await pool.query("SELECT * FROM receipts WHERE receipt_id=?", [id]);
    return rows.length ? rows[0] : null;
  },

  /* ============================================================
     🗑️ DELETE RECEIPT
  ============================================================ */
  async deleteReceipt(id) {
    const [result] = await pool.query(
      "DELETE FROM receipts WHERE receipt_id=?",
      [id]
    );
    return result.affectedRows > 0;
  }
};

module.exports = ReceiptModel;
