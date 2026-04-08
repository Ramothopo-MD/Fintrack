const UserModel = require('../Models/userModel');
const pool = require('../Config/db');
const bcrypt = require('bcrypt');
const ComplaintModel = require("../Models/complaintsModel");
const SubscriptionModel = require("../Models/userSubscriptionModel");
const SubscriptionPlanModel = require("../Models/subscription-plan");
const {sendBulkMail,sendUserMail} = require("../Services/emailService");

const AdminController = {

  /* ============================================================
     👑 ADMIN DASHBOARD
  ============================================================ */
getAdminDashboard: async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/user/login");
    if (req.session.user.role !== "ADMIN") {
      return res.status(403).render("error", { message: "Access denied. Admins only." });
    }

    // ===== Analytics: Spending by Category =====
    const [spendingByCategoryRows] = await pool.query(`
      SELECT 
        i.category,
        SUM(i.price * i.quantity) AS total
      FROM receipt_items i
      JOIN receipts r ON i.receipt_id = r.receipt_id
      GROUP BY i.category
      ORDER BY total DESC;
    `);

    // ===== Analytics: Spending by Shop =====
    const [spendingByShopRows] = await pool.query(`
      SELECT 
        store_name AS shop,
        SUM(total) AS total
      FROM receipts
      WHERE store_name IS NOT NULL AND store_name != ''
      GROUP BY store_name
      ORDER BY total DESC
      LIMIT 8;
    `);

    // ===== Analytics: Spending by Province =====
    const [spendingByAddressRows] = await pool.query(`
      SELECT 
        u.province AS province,
        SUM(r.total) AS total_spent
      FROM receipts r
      JOIN users u ON r.user_id = u.user_id
      GROUP BY u.province
      ORDER BY total_spent DESC;
    `);

    // ===== Total spent overall =====
    const [totalSpentResult] = await pool.query(`SELECT SUM(total) AS total_spent FROM receipts`);
    const totalSpent = totalSpentResult[0]?.total_spent || 0;

    // ===== Fetch core admin data =====
    const users = await UserModel.getAllUsers();
    const complaints = await ComplaintModel.getAll(100);
    const activeSubscriptions = await SubscriptionModel.getActiveSubscriptionsCount();
    const subscriptionPlans = await SubscriptionPlanModel.getAllPlans();

    // ===== Subscription analytics: Most used plan =====
    const [planUsageRows] = await pool.query(`
      SELECT 
        sp.name AS plan_name,
        COUNT(us.user_subscription_id) AS total_users
      FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.plan_id = us.plan_id
      GROUP BY sp.plan_id
      ORDER BY total_users DESC;
    `);

    const mostUsedPlan = planUsageRows.length > 0
      ? planUsageRows[0]
      : { plan_name: "N/A", total_users: 0 };

    // ===== Subscription analytics: Revenue per plan =====
    const [planRevenueRows] = await pool.query(`
      SELECT 
        sp.name AS plan_name,
        SUM(sp.price) AS total_revenue
      FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.plan_id = us.plan_id
      WHERE us.status IN ('active', 'trial')
      GROUP BY sp.plan_id
      ORDER BY total_revenue DESC;
    `);

    // ===== Prepare stats summary =====
    const stats = {
      totalUsers: users?.length || 0,
      totalComplaints: complaints?.length || 0,
      activeSubscriptions: activeSubscriptions || 0,
      totalSpent: parseFloat(totalSpent).toFixed(2),
    };

    // ===== Render dashboard =====
    res.render("Admin/admindashboard", {
      pageTitle: "Admin Dashboard",
      user: req.session.user,
      users,
      complaints,
      stats,
      spendingByCategory: spendingByCategoryRows,
      spendingByShop: spendingByShopRows,
      spendingByAddress: spendingByAddressRows,
      subscriptionPlans,
      mostUsedPlan,
      planUsageData: JSON.stringify(planUsageRows),
      planRevenueData: JSON.stringify(planRevenueRows),
    });

  } catch (error) {
    console.error("❌ Error loading admin dashboard:", error);
    res.status(500).render("error", {
      message: "Server error while loading admin dashboard",
      error: error.message,
    });
  }
},


//   /* ============================================================
//      👥 MANAGE USERS
//   ============================================================ */
//   getAllUsers: async (req, res) => {
//     try {
//       if (!req.session.user || req.session.user.role !== 'ADMIN') {
//         return res.status(403).render('error', { message: 'Access denied. Admins only.' });
//       }

//       const users = await UserModel.getAllUsers();
      
//       res.render('Admin/manage-users', {
//         users: users,
//         title: 'Manage Users',
//         currentPage: 'users',
//         user: req.session.user
//       });
//     } catch (error) {
//       console.error('❌ Error fetching users:', error);
//       res.render('Admin/manageUsers', {
//         users: [],
//         error: 'Failed to load users',
//         title: 'Manage Users',
//         currentPage: 'users',
//         user: req.session.user
//       });
//     }
//   },
/* ============================================================
     👥 MANAGE USERS
  ============================================================ */
getAllUsers: async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== 'ADMIN') {
            return res.status(403).render('error', { message: 'Access denied. Admins only.' });
        }

        const users = await UserModel.getAllUsers();
        
        res.render('Admin/manage-users', {
            users: users || [],
            title: 'Manage Users',
            currentPage: 'users',
            user: req.session.user,
            error: null,  // Explicitly pass error as null
            success: null // Explicitly pass success as null
        });
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.render('Admin/manage-users', {
            users: [],
            error: 'Failed to load users',
            title: 'Manage Users',
            currentPage: 'users',
            user: req.session.user,
            success: null // Make sure success is also passed
        });
    }
},
  /* ============================================================
      ✏️ UPDATE USER (ADMIN)
  ============================================================ */
updateUserByAdmin: async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "ADMIN") {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    const { id } = req.params;
    const { email, name, surname, country, province, city, role, password } = req.body;
    const fieldsToUpdate = {};

    if (email) fieldsToUpdate.email = email;
    if (name) fieldsToUpdate.name = name;
    if (surname) fieldsToUpdate.surname = surname;
    if (country) fieldsToUpdate.country = country;
    if (province) fieldsToUpdate.province = province;
    if (city) fieldsToUpdate.city = city;
    if (role) fieldsToUpdate.role = role;

    if (password && password.trim() !== "") {
      fieldsToUpdate.password = await bcrypt.hash(password, 10);
    }

    await UserModel.updateUser(id, fieldsToUpdate);

    console.log(`✅ Admin updated user ID: ${id}`);

    res.redirect("/admin/manage-users");
  } catch (error) {
    console.error("❌ Error updating user by admin:", error);
    res.status(500).render("error", { message: "Error updating user" });
  }
},

  /* ============================================================
     ✏️ UPDATE USER (ADMIN)
  ============================================================ */
  updateUser: async (req, res) => {
    try {
      if (!req.session.user || req.session.user.role !== 'ADMIN') {
        return res.status(403).render('error', { message: 'Access denied. Admins only.' });
      }

      const { id } = req.params;
      const { email, name, surname, country, province, city, role, password } = req.body;

      const fieldsToUpdate = {};
      if (email) fieldsToUpdate.email = email;
      if (name) fieldsToUpdate.name = name;
      if (surname) fieldsToUpdate.surname = surname;
      if (country) fieldsToUpdate.country = country;
      if (province) fieldsToUpdate.province = province;
      if (city) fieldsToUpdate.city = city;
      if (role) fieldsToUpdate.role = role;

      if (password && password.trim() !== '') {
        fieldsToUpdate.password = await bcrypt.hash(password, 10);
      }

      await UserModel.updateUser(id, fieldsToUpdate);

      console.log(`✅ Admin updated user ${id}`);
      res.redirect('/admin/manage-users');
    } catch (error) {
      console.error('❌ Error updating user:', error);
      res.status(500).render('error', { message: 'Error updating user' });
    }
  },

  /* ============================================================
     ➕ CREATE USER (ADMIN)
  ============================================================ */
createUser: async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'ADMIN') {
      return res.status(403).render('error', { message: 'Access denied. Admins only.' });
    }

    const { email, password, name, surname, country, province, city, role } = req.body;

    // ✅ Validate required fields
    if (!email || !password || !name || !surname) {
      return res.render('Admin/manage-users', { 
        error: 'Email, password, name, and surname are required',
        success: null,
        users: await UserModel.getAllUsers()
      });
    }

    // ✅ Check for existing user
    const existingUser = await UserModel.getUserByEmail(email);
    if (existingUser) {
      return res.render('Admin/manage-users', { 
        error: 'Email is already registered',
        success: null,
        users: await UserModel.getAllUsers()
      });
    }

    // ✅ Hash password and create user
    const password_hash = await bcrypt.hash(password, 10);
    console.log("password hash:", password_hash);
    await UserModel.createUser({
      email,
      password: password_hash,
      role: role || 'USER',
      name,
      surname,
      country,
      province,
      city
    });

    console.log(`✅ Admin created user: ${email}`);
    const user=req.session.user;
    console.log("session user:", user);
    // ✅ Send email
    const recipient = email;
    const subject = 'Your account has been created';
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f8ff; padding: 30px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          <div style="background-color: #003366; color: #ffffff; text-align: center; padding: 25px;">
            <h1 style="margin: 0; font-size: 22px;">FinTrack Account Created</h1>
          </div>
          <div style="padding: 25px; color: #333;">
            <p>Dear <strong>${name}</strong>,</p>
            <p style="font-size: 15px;">Your <strong>FinTrack</strong> account has been successfully created by the admin.</p>
            <p><strong>Login Email:</strong> ${email}</p>
            <p>Please visit <a href="https://fintrack.co.za/login" style="color:#004aad;">FinTrack Login</a> to access your account.</p>
            <p>We recommend changing your password after your first login.</p>
            <p style="font-size: 14px; color: #555;">Best regards,<br/><strong>FinTrack Team</strong></p>
          </div>
          <div style="background-color: #003366; color: #ffffff; text-align: center; font-size: 13px; padding: 15px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} FinTrack. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    await sendUserMail(recipient, subject, htmlContent);
    await sendUserMail(user.email, `You created an account for ${recipient}`,  `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f8ff; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background-color: #003366; color: #ffffff; text-align: center; padding: 25px;">
        <h1 style="margin: 0; font-size: 22px;">New User Added to FinTrack</h1>
      </div>

      <!-- Body -->
      <div style="padding: 25px; color: #333;">
        <p>Dear <strong>${req.session.user.name || "Admin"}</strong>,</p>

        <p style="font-size: 15px; line-height: 1.6;">
          You have successfully added a new user to the <strong>FinTrack</strong> system. Below are the account details of the user you created:
        </p>

        <div style="background-color: #f0f6ff; border-left: 4px solid #004aad; padding: 15px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; font-size: 15px;">
            <strong>Full Name:</strong> ${name} ${surname}<br/>
            <strong>Email:</strong> ${email}<br/>
            <strong>Role:</strong> ${role || "USER"}<br/>
            <strong>Location:</strong> ${city || "N/A"}, ${province || "N/A"}, ${country || "N/A"}
          </p>
        </div>

        <p style="font-size: 15px;">
          The user has been notified via email and can now log in using their registered credentials.
        </p>

        <!-- Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://fintrack.co.za/admin/manage-users" 
             style="background-color: #004aad; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; display: inline-block;">
            View All Users
          </a>
        </div>

        <p style="font-size: 14px; color: #555;">Best regards,<br/><strong>FinTrack System</strong></p>
      </div>

      <!-- Footer -->
      <div style="background-color: #003366; color: #ffffff; text-align: center; font-size: 13px; padding: 15px;">
        <p style="margin: 0;">© ${new Date().getFullYear()} FinTrack. All rights reserved.</p>
      </div>
    </div>
  </div>
`);

    // ✅ Redirect with success message
    res.redirect('/admin/manage-users?success=User created successfully');
  } catch (error) {
    console.error("❌ Admin user creation error:", error);
    res.render('Admin/manage-users', { 
      error: 'Error creating user',
      success: null,
      users: await UserModel.getAllUsers()
    });
  }
},
  // ✅ Send filtered emails to users
  // In your AdminController - fix the sendEmailToUsers function
async sendEmailToUsers(req, res) {
  try {
    const { province, city, plan, subject, message } = req.body;

    // 🔒 Validate input
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Please provide both subject and message.",
      });
    }

    // 🧠 Build SQL query dynamically
    let query = `
      SELECT DISTINCT u.email 
      FROM users u
      LEFT JOIN user_subscriptions us ON u.user_id = us.user_id
      LEFT JOIN subscription_plans sp ON sp.plan_id = us.plan_id
      WHERE 1=1
    `;
    const params = [];

    if (province) {
      query += " AND u.province = ?";
      params.push(province);
    }
    if (city) {
      query += " AND u.city = ?";
      params.push(city);
    }
    if (plan) {
      query += " AND sp.name = ?";
      params.push(plan);
    }

    const [users] = await pool.query(query, params);

    if (!users.length) {
      return res.json({
        success: false,
        message: "No users found for the selected filters.",
      });
    }

    const recipients = users.map((u) => u.email);
    
    // ✉️ Send bulk mail - FIXED: Use sendBulkMail instead of sendUserMail
    const result = await sendBulkMail([
    "ramothopomd@gmail.com",
    "mosewadesmond919@gmail.com"
  ], subject, message);

    // 🧾 Log & respond
    console.log(`📧 Bulk email result: ${result.sent}/${result.total} users successfully.`);

    return res.json({
      success: true,
      message: `Emails sent successfully to ${result.sent}/${result.total} users.`,
    });
  } catch (err) {
    console.error("❌ Error sending emails:", err);
    return res.status(500).json({
      success: false,
      message: "An internal error occurred while sending emails.",
    });
  }
},


  /* ============================================================
     🗑️ DELETE USER (ADMIN)
  ============================================================ */
  deleteUser: async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.session.user || req.session.user.role !== 'ADMIN') {
      return res.status(403).render('error', { message: 'Access denied. Admins only.' });
    }
    if (req.session.user.user_id === parseInt(id)) {
      return res.status(400).render('error', { message: 'Admins cannot delete their own account.' });
    }

    await UserModel.deleteUser(id);
    console.log(`🗑️ Admin deleted user ID ${id}`);
    
    // Redirect back to users page with success message
    req.session.success = 'User deleted successfully';
    res.redirect('/admin/manage-users');
  } catch (error) {
    console.error('❌ Admin delete error:', error);
    req.session.error = 'Error deleting user';
    res.redirect('/admin/manage-users');
  }
},
  logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ Logout error:', err);
        return res.status(500).render('error', { message: 'Error logging out' });
      }
      res.redirect('/user/login');
    });
}

};

module.exports = AdminController;