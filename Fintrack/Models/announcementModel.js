const pool = require('../Config/db');

const AnnouncementModel = {
  // ✅ Create table if not exists
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        announcement_id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    console.log("✅ 'announcements' table is ready.");
  },

  // ✅ Create a new announcement
  async create({ admin_id, title, message, category = 'General', status = 'active' }) {
    const [result] = await pool.query(
      `INSERT INTO announcements (admin_id, title, message, category, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [admin_id, title, message, category, status]
    );
    return result.insertId;
  },

  // ✅ Fetch all announcements (for Admin)
  async getAll(limit = 100) {
    const [rows] = await pool.query(`
      SELECT 
        a.announcement_id,
        a.title,
        a.message,
        a.category,
        a.status,
        a.created_at,
        CONCAT(u.name, ' ', u.surname) AS admin_name
      FROM announcements a
      LEFT JOIN users u ON a.admin_id = u.user_id
      ORDER BY a.created_at DESC
      LIMIT ?
    `, [limit]);
    return rows;
  },
   // ✅ Toggle announcement status
  async toggleStatus(id) {
    const [current] = await pool.query(
      `SELECT status FROM announcements WHERE announcement_id = ?`,
      [id]
    );

    if (current.length === 0) return false;

    const newStatus = current[0].status === 'active' ? 'inactive' : 'active';
    const [result] = await pool.query(
      `UPDATE announcements SET status = ? WHERE announcement_id = ?`,
      [newStatus, id]
    );

    return result.affectedRows > 0 ? newStatus : false;
  }
,

  // ✅ Fetch announcements for Users (active only)
  async getForUser(limit = 20) {
    const [rows] = await pool.query(`
      SELECT 
        a.announcement_id,
        a.title,
        a.message,
        a.category,
        a.created_at,
        CONCAT(u.name, ' ', u.surname) AS admin_name
      FROM announcements a
      LEFT JOIN users u ON a.admin_id = u.user_id
      WHERE a.status = 'active'
      ORDER BY a.created_at DESC
      LIMIT ?
    `, [limit]);
    return rows;
  },

  // ✅ Get a single announcement by ID
  async getById(id) {
    const [rows] = await pool.query(`
      SELECT 
        a.*,
        CONCAT(u.name, ' ', u.surname) AS admin_name
      FROM announcements a
      LEFT JOIN users u ON a.admin_id = u.user_id
      WHERE a.announcement_id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  },

  // ✅ Update announcement
  async update(id, { title, message, category, status }) {
    const [result] = await pool.query(
      `UPDATE announcements 
       SET title = ?, message = ?, category = ?, status = ? 
       WHERE announcement_id = ?`,
      [title, message, category, status, id]
    );
    return result.affectedRows > 0;
  },

  // ✅ Delete announcement
  async delete(id) {
    const [result] = await pool.query(
      `DELETE FROM announcements WHERE announcement_id = ?`, 
      [id]
    );
    return result.affectedRows > 0;
  },

  // ✅ Get recent announcements (for dashboard widgets)
  async getRecent(limit = 5) {
    const [rows] = await pool.query(`
      SELECT 
        a.title,
        a.message,
        a.category,
        a.created_at,
        CONCAT(u.name, ' ', u.surname) AS admin_name
      FROM announcements a
      LEFT JOIN users u ON a.admin_id = u.user_id
      WHERE a.status = 'active'
      ORDER BY a.created_at DESC
      LIMIT ?
    `, [limit]);
    return rows;
  }
};

module.exports = AnnouncementModel;
