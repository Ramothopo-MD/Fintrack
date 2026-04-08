const pool = require('../Config/db');

const ComplaintModel = {
  // ✅ Create table if it doesn't exist
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        complaint_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
      )
    `);
    console.log("✅ complaints table ready");
  },

  // ✅ Log new complaint
  async createComplaint({ user_id, subject, message, priority }) {
    const [result] = await pool.query(
      `INSERT INTO complaints (user_id, subject, message, priority) VALUES (?, ?, ?, ?)`,
      [user_id, subject, message, priority || 'medium']
    );
    return result.insertId;
  },

  // ✅ Get all complaints (admin view)
  async getAll(limit = 50) {
    const [rows] = await pool.query(`
      SELECT 
        c.*, 
        CONCAT(u.name, ' ', u.surname) AS full_name, 
        u.email
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      ORDER BY c.created_at DESC
      LIMIT ?
    `, [limit]);
    return rows;
  },

  // ✅ Get single complaint
  async getById(id) {
    const [rows] = await pool.query(`
      SELECT 
        c.*, 
        CONCAT(u.name, ' ', u.surname) AS full_name, 
        u.email
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      WHERE complaint_id = ?
    `, [id]);
    return rows[0];
  },

  // ✅ Update complaint
  async updateComplaint(id, { status, priority }) {
    const [result] = await pool.query(
      `UPDATE complaints SET status = ?, priority = ? WHERE complaint_id = ?`,
      [status, priority, id]
    );
    return result.affectedRows > 0;
  },

  // ✅ Delete complaint
  async deleteComplaint(id) {
    const [result] = await pool.query(
      `DELETE FROM complaints WHERE complaint_id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  },

  // ✅ Count open complaints
  async countOpen() {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM complaints WHERE status IN ('open', 'in_progress')`
    );
    return rows[0].count || 0;
  }
};

module.exports = ComplaintModel;
