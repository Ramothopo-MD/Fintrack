const pool = require("../Config/db");

const IncomeModel = {
  // ✅ Create table
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incomes (
        income_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        source VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    console.log("✅ Incomes table ready (multiple per user allowed)");
  },

  // ✅ CREATE
  async createIncome(userId, amount, source) {
    const [result] = await pool.query(
      "INSERT INTO incomes (user_id, amount, source) VALUES (?, ?, ?)",
      [userId, amount, source]
    );
    return result.insertId;
  },

  // ✅ READ (all for one user)
  async getIncome(userId) {
    const [rows] = await pool.query(
      "SELECT * FROM incomes WHERE user_id = ? ORDER BY updated_at DESC",
      [userId]
    );
    return rows;
  },

  // ✅ READ ALL (admin/debugging)
  async getAllIncomes() {
    const [rows] = await pool.query("SELECT * FROM incomes ORDER BY updated_at DESC");
    return rows;
  },

  // ✅ UPDATE
  async updateIncome(incomeId, newAmount, newSource) {
    const [result] = await pool.query(
      "UPDATE incomes SET amount = ?, source = ? WHERE income_id = ?",
      [newAmount, newSource, incomeId]
    );
    return result.affectedRows > 0;
  },

  // ✅ DELETE
  async deleteIncome(incomeId) {
    const [result] = await pool.query(
      "DELETE FROM incomes WHERE income_id = ?",
      [incomeId]
    );
    return result.affectedRows > 0;
  }
};

module.exports = IncomeModel;
