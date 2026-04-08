const pool = require("../Config/db");

const UserSubscriptionModel = {
  // ✅ Create table if not exists
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        user_subscription_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        status ENUM('trial','active','canceled','expired') DEFAULT 'trial',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        trial_end_date DATE DEFAULT NULL,
        trial_used BOOLEAN DEFAULT FALSE,
        auto_renew BOOLEAN DEFAULT TRUE,
        requests_used INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES subscription_plans(plan_id) ON DELETE CASCADE
      )
    `);
    console.log("✅ user_subscriptions table ready");
  },

  // ✅ Create a new subscription record
  async createSubscription(data) {
    const [result] = await pool.query(
      `INSERT INTO user_subscriptions 
        (user_id, plan_id, status, start_date, end_date, trial_end_date, trial_used, auto_renew)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.plan_id,
        data.status || "active",
        data.start_date,
        data.end_date,
        data.trial_end_date || null,
        data.trial_used || false,
        data.auto_renew !== undefined ? data.auto_renew : true
      ]
    );
    return result.insertId;
  },

  // ✅ Get all subscriptions for a user
  async getUserSubscriptions(userId) {
    const [rows] = await pool.query(
      `SELECT us.*, sp.name AS plan_name, sp.price, sp.billing_cycle
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.plan_id = us.plan_id
       WHERE us.user_id = ?
       ORDER BY us.start_date DESC`,
      [userId]
    );
    return rows;
  },
  // ✅ Count all active or trial subscriptions
async getActiveSubscriptionsCount() {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM user_subscriptions
    WHERE status IN ('active', 'trial')
      AND CURRENT_DATE BETWEEN start_date AND end_date
  `);
  return rows[0].total || 0;
}
,

  // ✅ Get active subscription for a user
  async getActiveSubscription(userId) {
    const [rows] = await pool.query(
      `SELECT us.*, sp.name AS plan_name, sp.price, sp.request_limit, sp.billing_cycle
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.plan_id = us.plan_id
       WHERE us.user_id = ?
         AND us.status IN ('active', 'trial')
         AND CURRENT_DATE BETWEEN us.start_date AND us.end_date
       ORDER BY us.end_date DESC
       LIMIT 1`,
      [userId]
    );
    return rows.length ? rows[0] : null;
  },

  // ✅ Mark a subscription as canceled
  async cancelSubscription(userId) {
    const [result] = await pool.query(
      `UPDATE user_subscriptions
       SET status = 'canceled', auto_renew = FALSE, updated_at = NOW()
       WHERE user_id = ? AND status IN ('active', 'trial')`,
      [userId]
    );
    return result.affectedRows > 0;
  },

  // ✅ Increment usage counter (used by AI/feature usage)
  async incrementUsage(subscriptionId) {
    await pool.query(
      `UPDATE user_subscriptions
       SET requests_used = requests_used + 1, updated_at = NOW()
       WHERE user_subscription_id = ?`,
      [subscriptionId]
    );
  },

  // ✅ Expire old subscriptions (optional: run with cron)
  async expireOldSubscriptions() {
    const [result] = await pool.query(`
      UPDATE user_subscriptions
      SET status = 'expired'
      WHERE end_date < CURDATE() AND status IN ('active', 'trial')
    `);
    return result.affectedRows;
  },

  // ✅ Delete subscription (for admin)
  async deleteSubscription(id) {
    const [result] = await pool.query(
      `DELETE FROM user_subscriptions WHERE user_subscription_id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }
};

module.exports = UserSubscriptionModel;
