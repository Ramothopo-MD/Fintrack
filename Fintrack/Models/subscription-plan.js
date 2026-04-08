const pool = require("../Config/db");

const SubscriptionPlanModel = {
  // ✅ Create table if not exists
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        plan_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type ENUM('individual', 'organization', 'enterprise') DEFAULT 'individual',
        request_limit INT DEFAULT 100,
        start_date DATE DEFAULT NULL,
        end_date DATE DEFAULT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_by INT NULL,
        billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly',
        trial_days INT DEFAULT 0,
        features LONGTEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
      )
    `);
    console.log("✅ subscription_plans table ready");
  },

  // ✅ Get all active plans
  async getAll() {
    const [rows] = await pool.query(`
      SELECT * FROM subscription_plans
      WHERE status = 'active'
      ORDER BY created_at DESC
    `);
    return rows;
  },

  // ✅ Create a new plan
  async createPlan(planData) {
    const [result] = await pool.query(
      `INSERT INTO subscription_plans
        (name, type, request_limit, start_date, end_date, price, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planData.name,
        planData.type,
        planData.request_limit,
        planData.start_date,
        planData.end_date,
        planData.price,
        planData.description,
        planData.status || "active",
        planData.created_by || null
      ]
    );
    return result.insertId;
  },

  // ✅ Admin / Manager view (shows creator info)
  async getAllPlans() {
    const [rows] = await pool.query(`
      SELECT 
        p.*, 
        CONCAT(u.name, ' ', u.surname) AS creator_name, 
        u.email AS creator_email
      FROM subscription_plans p
      LEFT JOIN users u ON p.created_by = u.user_id
      ORDER BY p.created_at DESC
    `);
    return rows;
  },

  // ✅ Get plan by ID (for checkout, etc.)
  async getPlanById(planId) {
    const [rows] = await pool.query(`
      SELECT 
        p.*, 
        CONCAT(u.name, ' ', u.surname) AS creator_name, 
        u.email AS creator_email
      FROM subscription_plans p
      LEFT JOIN users u ON p.created_by = u.user_id
      WHERE p.plan_id = ?
    `, [planId]);
    return rows.length ? rows[0] : null;
  },

  // ✅ Get plans by a specific creator (admin)
  async getPlansByCreator(userId) {
    const [rows] = await pool.query(`
      SELECT 
        p.*, 
        CONCAT(u.name, ' ', u.surname) AS creator_name, 
        u.email AS creator_email
      FROM subscription_plans p
      LEFT JOIN users u ON p.created_by = u.user_id
      WHERE p.created_by = ?
      ORDER BY p.created_at DESC
    `, [userId]);
    return rows;
  },

  // ✅ Update plan info
  async updatePlan(planId, data) {
    await pool.query(`
      UPDATE subscription_plans
      SET name=?, type=?, request_limit=?, start_date=?, end_date=?, price=?, description=?, status=?, updated_at=NOW()
      WHERE plan_id=?
    `, [
      data.name,
      data.type,
      data.request_limit,
      data.start_date,
      data.end_date,
      data.price,
      data.description,
      data.status || "active",
      planId
    ]);
    const [rows] = await pool.query(`SELECT * FROM subscription_plans WHERE plan_id=?`, [planId]);
    return rows.length ? rows[0] : null;
  },

  // ✅ Delete a plan
  async deletePlan(planId) {
    const [result] = await pool.query(`DELETE FROM subscription_plans WHERE plan_id=?`, [planId]);
    return result.affectedRows > 0;
  },

  // ✅ Transfer all plans from one user to another
  async transferPlans(fromUserId, toUserId) {
    const [result] = await pool.query(`
      UPDATE subscription_plans 
      SET created_by = ?, updated_at = NOW() 
      WHERE created_by = ?
    `, [toUserId, fromUserId]);
    return result.affectedRows;
  }
};

module.exports = SubscriptionPlanModel;
