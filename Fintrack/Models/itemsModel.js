const pool = require("../Config/db");

const ItemModel = {
  async createTable() {
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
    console.log("✅ Items table ready");
  },

  // CREATE
  async addItem(receiptId, item) {
    const [result] = await pool.query(
      `INSERT INTO receipt_items (receipt_id, name, price, category, quantity) VALUES (?, ?, ?, ?, ?)`,
      [receiptId, item.name, item.price, item.category, item.quantity ?? 1] // ✅ safe fallback
    );
    return result.insertId;
  },

  // READ: All items for a receipt
  async getItemsByReceiptId(receiptId) {
    const [rows] = await pool.query(
      "SELECT * FROM receipt_items WHERE receipt_id=?",
      [receiptId]
    );
    return rows;
  },

  // READ: One item
  async getItemById(itemId) {
    const [rows] = await pool.query(
      "SELECT * FROM receipt_items WHERE item_id=?",
      [itemId]
    );
    return rows.length ? rows[0] : null;
  },

  // UPDATE
  async updateItem(itemId, data) {
  await pool.query(
    `UPDATE receipt_items 
     SET name=?, price=?, category=?, quantity=? 
     WHERE item_id=?`,
    [data.name, data.price, data.category, data.quantity ?? 1, itemId]
  );

  const [rows] = await pool.query(
    "SELECT * FROM receipt_items WHERE item_id=?",
    [itemId]
  );

  return rows[0];
}
,
  // DELETE: One item
  async deleteItem(itemId) {
    await pool.query("DELETE FROM receipt_items WHERE item_id=?", [itemId]);
    return true;
  },

  // DELETE: All items of a receipt
  async deleteItemsByReceipt(receiptId) {
    await pool.query("DELETE FROM receipt_items WHERE receipt_id=?", [receiptId]);
    return true;
  }
};

module.exports = ItemModel;
