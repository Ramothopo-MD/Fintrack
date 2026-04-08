const pool = require("../Config/db");

const BudgetModel = {
  // ✅ Create table if it doesn’t exist
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        budget_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        type ENUM('GENERAL','CATEGORY') NOT NULL,
        category VARCHAR(100), -- only used when type = 'CATEGORY'
        amount DECIMAL(10,2) NOT NULL,
        period ENUM('WEEKLY','MONTHLY','YEARLY') DEFAULT 'MONTHLY',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    console.log("✅ Budgets table ready");
  },

  // ✅ Create a budget
  async createBudget(budget) {
    const [result] = await pool.query(
      `INSERT INTO budgets (user_id, name, type, category, amount, period)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        budget.user_id,
        budget.name,          // new required field
        budget.type,          // 'GENERAL' or 'CATEGORY'
        budget.category || null,
        budget.amount,
        budget.period || "MONTHLY"
      ]
    );
    return result.insertId;
  },

  // ✅ Get all budgets for a user
  async getBudgetsByUser(user_id) {
    const [rows] = await pool.query(
      "SELECT * FROM budgets WHERE user_id = ? ORDER BY created_at DESC",
      [user_id]
    );
    return rows;
  },

  // ✅ Get general budget for a user
  async getGeneralBudget(user_id) {
    const [rows] = await pool.query(
      "SELECT * FROM budgets WHERE user_id = ? AND type = 'GENERAL' LIMIT 1",
      [user_id]
    );
    return rows[0] || null;
  },

  // ✅ Get all category budgets for a user
  async getCategoryBudgets(user_id) {
    const [rows] = await pool.query(
      "SELECT * FROM budgets WHERE user_id = ? AND type = 'CATEGORY'",
      [user_id]
    );
    return rows;
  },

  // ✅ Update a budget (amount, name, category, period, etc.)
  async updateBudget(id, fields) {
    const updates = [];
    const values = [];
    for (const key in fields) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
    values.push(id);

    await pool.query(
      `UPDATE budgets SET ${updates.join(", ")} WHERE budget_id = ?`,
      values
    );
    return true;
  },

  // ✅ Delete a budget
  async deleteBudget(id) {
    await pool.query("DELETE FROM budgets WHERE budget_id = ?", [id]);
    return true;
  }
};

module.exports = BudgetModel;
