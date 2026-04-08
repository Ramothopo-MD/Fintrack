const pool = require("../Config/db");

const UserModel = {
  // ✅ Create users table (now includes profile_photo)
  async createTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(150) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role ENUM('USER', 'ADMIN') DEFAULT 'USER',
          name VARCHAR(100) NOT NULL,
          surname VARCHAR(100) NOT NULL,
          country VARCHAR(100) NOT NULL,
          province VARCHAR(100) NOT NULL,
          city VARCHAR(100) NOT NULL,
          profile_photo VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ Users table ready (with profile_photo column)");
    } catch (error) {
      console.error("❌ Error creating users table:", error);
    }
  },

  // ✅ Create new user (photo optional; password must be hashed)
  async createUser(user) {
    try {
      const [result] = await pool.query(
        `
        INSERT INTO users (
          email, password, role, name, surname, country, province, city, profile_photo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          user.email,
          user.password, 
          user.role || "USER",
          user.name,
          user.surname,
          user.country,
          user.province,
          user.city,
          user.profile_photo || null, 
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error("❌ Error creating user:", error);
      throw error;
    }
  },

  // ✅ Get user by email
  async getUserByEmail(email) {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM users WHERE email = ? LIMIT 1",
        [email]
      );
      return rows[0] || null;
    } catch (error) {
      console.error("❌ Error fetching user by email:", error);
      throw error;
    }
  },

  // ✅ Get user by ID
  async getUserById(id) {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM users WHERE user_id = ? LIMIT 1",
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      console.error("❌ Error fetching user by ID:", error);
      throw error;
    }
  },

  // ✅ Update user (supports profile_photo)
  async updateUser(id, fields) {
    try {
      if (!fields || Object.keys(fields).length === 0) {
        throw new Error("No fields provided for update");
      }

      const updates = [];
      const values = [];

      for (const key in fields) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }

      values.push(id);

      await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`,
        values
      );

      return true;
    } catch (error) {
      console.error("❌ Error updating user:", error);
      throw error;
    }
  },

  // ✅ Delete user by ID
// ✅ Delete user by ID with enhanced error handling
async deleteUser(id) {
    try {
        // First, check if user exists
        const [userExists] = await pool.query(
            "SELECT user_id FROM users WHERE user_id = ?", 
            [id]
        );
        
        if (userExists.length === 0) {
            throw new Error('User not found');
        }

        const [result] = await pool.query(
            "DELETE FROM users WHERE user_id = ?", 
            [id]
        );
        
        if (result.affectedRows === 0) {
            throw new Error('No user was deleted');
        }
        
        console.log(`✅ User ${id} deleted successfully`);
        return true;
    } catch (error) {
        console.error("❌ Error deleting user:", error);
        
        // Handle foreign key constraints
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            throw new Error('Cannot delete user: User has related records in other tables');
        }
        
        throw error;
    }
},

  // ✅ Get all users (shows newest first)
  async getAllUsers() {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM users ORDER BY created_at DESC"
      );
      return rows;
    } catch (error) {
      console.error("❌ Error fetching all users:", error);
      throw error;
    }
  },
};

module.exports = UserModel;
