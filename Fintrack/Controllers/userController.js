const { sendUserMail } = require('../Services/emailService');
const UserModel = require('../Models/userModel');
const pool = require('../Config/db');
const bcrypt = require('bcrypt');
const os = require('os');
const ReceiptModel = require('../Models/receiptModel');
const budgetModel = require('../Models/budgetModel');
const incomeModel = require('../Models/incomeModel');
const AnnouncementModel= require('../Models/announcementModel');
const { generateDeepseekPredictions } = require('../Services/predictionService');
const path = require("path");
const fs = require("fs");


const UserController = {

  // ===============================
  // 🔐 AUTH PAGES
  // ===============================
  getLoginPage: (req, res) => res.render('login'),
  getRegisterPage: (req, res) => res.render('register'),

  // ===============================
  // 🧍 REGISTER USER
  // ===============================
  createAccount: async (req, res) => {
    const { email, password, confirmPassword, name, surname, country, province, city } = req.body;

    if (!email || !password || !confirmPassword || !name || !surname || !country || !province || !city) {
      return res.render('register', { error: 'All fields are required' });
    }
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match' });
    }

    try {
      const existingUser = await UserModel.getUserByEmail(email);
      if (existingUser) {
        return res.render('register', { error: 'Email is already registered' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const userId = await UserModel.createUser({
        email,
        password: password_hash,
        role: 'USER',
        name,
        surname,
        country,
        province,
        city
      });

      const newUser = await UserModel.getUserById(userId);

      // ✅ Save session
      req.session.user = {
        user_id: newUser.user_id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        surname: newUser.surname
      };

      // ✅ Send welcome email
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; background-color:#f5f9ff; padding:20px;">
          <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <div style="background:#004080; padding:20px; text-align:center; color:#fff;">
              <h2>Welcome to <span style="color:#ffc107;">FinTrack</span>, ${newUser.name}!</h2>
            </div>
            <div style="padding:20px; color:#333; line-height:1.6;">
              <p>🎉 Your account has been successfully created.</p>
              <p>Manage your budgets, receipts, and spending with <strong>AI-powered insights</strong>.</p>
            </div>
            <div style="background:#f8f9fa; padding:15px; text-align:center; font-size:13px; color:#666;">
              <p>&copy; ${new Date().getFullYear()} FinTrack. All rights reserved.</p>
            </div>
          </div>
        </div>
      `;
      // await sendUserMail(newUser.email, 'Welcome to FinTrack!', htmlContent);

      res.redirect('/user/dashboard');
    } catch (error) {
      console.error("❌ Registration error:", error);
      res.status(500).render('register', { error: 'Error creating account' });
    }
  },

  // ===============================
  // 🔑 LOGIN USER
  // ===============================
    login: async (req, res) => {
    const { email, password } = req.body;

    try {
      // ✅ 1. Find user by email
      const user = await UserModel.getUserByEmail(email);
      if (!user) {
        return res.status(400).render("login", { error: "Email not found" });
      }

      // ✅ 2. Validate password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).render("login", { error: "Incorrect password" });
      }

      // ✅ 3. Create safe user session
      req.session.user = {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        name: user.name || "User",
        surname: user.surname || "",
        country: user.country || "",
        province: user.province || "",
        city: user.city || "",
        profile_photo:
          user.profile_photo && user.profile_photo.trim() !== ""
            ? user.profile_photo
            : "/images/default-avatar.jpg",
      };

      // ✅ 4. Make session user available to all views
      res.locals.user = req.session.user;

      // ✅ 5. Send login alert email
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; background-color:#f5f9ff; padding:20px;">
          <div style="max-width:600px; margin:auto; background:#fff; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
            <div style="background:linear-gradient(135deg,#004080,#0066cc); padding:25px; text-align:center; color:#fff;">
              <h2>🔒 FinTrack Login Alert</h2>
            </div>
            <div style="padding:25px; line-height:1.6;">
              <h3>Hi ${user.name || "User"},</h3>
              <p>A new login to your FinTrack account was detected:</p>
              <ul>
                <li>📱 Device: ${os.hostname()}</li>
                <li>💻 OS: ${os.platform()}</li>
                <li>🕒 Time: ${new Date().toLocaleString()}</li>
              </ul>
              <p>If this wasn’t you, please reset your password immediately.</p>
            </div>
          </div>
        </div>
      `;
      await sendUserMail(user.email, "New Login to FinTrack", htmlContent);

      // ✅ 6. Redirect based on role
      if (user.role === "ADMIN") {
        console.log(`👑 Admin logged in: ${user.email}`);
        return res.redirect("/admin/dashboard");
      }

      console.log(`👤 User logged in: ${user.email}`);
      return res.redirect("/user/dashboard");
    } catch (error) {
      console.error("❌ Login error:", error);
      res.status(500).render("login", { error: "Error logging in" });
    }
  },
  // ===============================
  // 🏠 USER DASHBOARD
  // ===============================
   renderHomePage: async (req, res) => {
    try {
      // 🧍 Require login
      if (!req.session.user) return res.redirect("/user/login");

      const user = req.session.user;
      const userId = user.user_id;

      // 🧾 Receipts with items
      const receipts = await ReceiptModel.getAllByUserWithItems(userId);

      // 💰 Totals by category
      const categoryTotals = {};
      let totalSpent = 0;
      receipts.forEach(r => {
        totalSpent += Number(r.total) || 0;
        if (r.items) {
          r.items.forEach(item => {
            const category = item.category || "Uncategorized";
            const amount = (Number(item.price) || 0) * (item.quantity || 1);
            categoryTotals[category] = (categoryTotals[category] || 0) + amount;
          });
        }
      });

      // 📊 Budget stats
      const generalBudget = await budgetModel.getGeneralBudget(userId);
      const budget = generalBudget ? Number(generalBudget.amount) : 0;
      const budgetProgress = budget > 0 ? Math.min(((totalSpent / budget) * 100).toFixed(0), 100) : 0;
      const receiptCount = receipts.length;

      // 🏆 Top category
      let topCategory = "N/A", maxSpend = 0;
      for (const [cat, amount] of Object.entries(categoryTotals)) {
        if (amount > maxSpend) { topCategory = cat; maxSpend = amount; }
      }

      // 📅 Monthly Spending Trend
      const monthlySpending = receipts.reduce((acc, r) => {
        if (r.date && r.total) {
          const month = new Date(r.date).toISOString().slice(0, 7);
          acc[month] = (acc[month] || 0) + Number(r.total);
        }
        return acc;
      }, {});
      const monthlySpendingArr = Object.entries(monthlySpending).map(([month, total]) => ({ month, total }));

      // 📢 Load Announcements for user
      const announcements = await AnnouncementModel.getForUser(20);

      // 🧠 Optional: preload prediction placeholders
      const predictions = {
        monthlyForecast: [],
        storeForecast: [],
        insights: ["Loading AI predictions..."]
      };

      // ✅ Render Dashboard
      res.render("User/userDashboard", {
        user,
        receipts,
        stats: { totalSpent, budget, budgetProgress, receiptCount, topCategory },
        categoryTotals: JSON.stringify(categoryTotals),
        monthlySpending: JSON.stringify(monthlySpendingArr),
        aiPredictions: JSON.stringify(predictions),
        announcements // ✅ Pass to EJS
      });
    } catch (err) {
      console.error("❌ Error rendering dashboard:", err);
      res.status(500).send("Server error while loading dashboard");
    }
  },

  // ===============================
  // 🤖 FETCH AI PREDICTIONS
  // ===============================
  getAIPredictions: async (req, res) => {
    try {
      if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

      const userId = req.session.user.user_id;
      const predictions = await generateDeepseekPredictions(userId, 3);
      res.json(predictions);
    } catch (err) {
      console.warn("⚠️ DeepSeek AI failed:", err.message);
      res.json({
        monthlyForecast: [
          { month: "2025-09", total_spent: 1000 },
          { month: "2025-10", total_spent: 1200 },
          { month: "2025-11", total_spent: 1300 }
        ],
        storeForecast: [
          { store: "Shoprite", predicted_spent: 800 },
          { store: "Checkers", predicted_spent: 650 }
        ],
        insights: ["AI temporarily unavailable. Showing estimated predictions."]
      });
    }
  },

  // ===============================
  // 📤 UPLOAD RECEIPTS PAGE
  // ===============================
  getUploadPage: async (req, res) => {
  if (!req.session.user) return res.redirect("/user/login");

  try {
    const userId = req.session.user.user_id;
    const receipts = await ReceiptModel.getAllByUserWithItems(userId);

    const totalReceipts = receipts.length;
    const categoryTotals = {};
    const monthlyTotals = {};
    let totalSpent = 0;

    receipts.forEach((r) => {
      const receiptTotal = Number(r.total) || 0; // 👈 force number
      totalSpent += receiptTotal;

      // 🗓 group by month (YYYY-MM key for sorting)
      if (r.date) {
        const d = new Date(r.date);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${String(
            d.getMonth() + 1
          ).padStart(2, "0")}`; // e.g. 2025-11
          if (!monthlyTotals[key]) monthlyTotals[key] = 0;
          monthlyTotals[key] += receiptTotal;
        }
      }

      // 🏷 category totals from items
      (r.items || []).forEach((item) => {
        const cat = item.category || "Uncategorized";
        const itemTotal =
          (Number(item.price) || 0) * (Number(item.quantity) || 1);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + itemTotal;
      });
    });

    const avgSpent =
      totalReceipts > 0 ? Number((totalSpent / totalReceipts).toFixed(2)) : 0;

    const topCategoryEntry = Object.entries(categoryTotals).sort(
      (a, b) => b[1] - a[1]
    )[0];
    const topCategory = topCategoryEntry ? topCategoryEntry[0] : "N/A";

    // 🔢 sort months chronologically by YYYY-MM
    const monthKeys = Object.keys(monthlyTotals).sort(); // "2025-09", "2025-10", ...

    const stats = {
      totalReceipts,
      totalSpent, // ✅ number
      avgSpent,
      topCategory,
      categories: Object.keys(categoryTotals),
      categoryValues: Object.values(categoryTotals),
      months: monthKeys.map((key) => {
        const [year, month] = key.split("-");
        const d = new Date(Number(year), Number(month) - 1, 1);
        return d.toLocaleString("default", { month: "short", year: "numeric" });
      }),
      monthValues: monthKeys.map((key) => monthlyTotals[key]),
    };

    res.render("User/manage-receipts", {
      user: req.session.user,
      receipts,
      stats,
      error: req.query.error || null,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error("❌ Error loading receipts:", err);
    res.render("User/manage-receipts", {
      user: req.session.user,
      receipts: [],
      stats: {
        totalReceipts: 0,
        totalSpent: 0,
        avgSpent: 0,
        topCategory: "N/A",
        categories: [],
        categoryValues: [],
        months: [],
        monthValues: [],
      },
      error: "Failed to load receipts",
      success: null,
    });
  }
},


  // ===============================
  // 💰 BUDGET PAGE
  // ===============================
  getBudgetPage: async (req, res) => {
    if (!req.session.user) return res.redirect('/user/login');
    try {
      const userId = req.session.user.user_id;
      const generalBudget = await budgetModel.getGeneralBudget(userId);
      const categoryBudgets = await budgetModel.getCategoryBudgets(userId);
      const income = await incomeModel.getIncome(userId);
      const totalAllocated = categoryBudgets.reduce((sum, b) => sum + Number(b.amount), 0);
      const balance = income ? income - totalAllocated : null;

      res.render("User/manage-budget", {
        user: req.session.user,
        generalBudget,
        categoryBudgets,
        income,
        balance
      });
    } catch (err) {
      console.error("❌ Error loading budget page:", err);
      res.status(500).send("Server error");
    }
  },

  // ===============================
  // 🚪 LOGOUT
  // ===============================
 // ===============================
// 🚪 LOGOUT (Works for Admin & User)
// ===============================
logout: (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login'); // shared login page
    }

    const role = req.session.user.role;

    req.session.destroy(err => {
      if (err) {
        console.error('❌ Logout error:', err);
        return res.status(500).send('Error logging out');
      }

      // 🧹 Clear session cookie (match your session name in app.js)
      res.clearCookie('fintrack.sid');
      console.log('✅ Session cookie cleared');

     

      return res.redirect('/login?success=You have been logged out');
    });
  } catch (error) {
    console.error('❌ Unexpected logout error:', error);
    res.status(500).send('Server error during logout');
  }
},


  // ===============================
  // ❌ DELETE ACCOUNT
  // ===============================
  deleteAccount: async (req, res) => {
    try {
      if (!req.session.user) return res.status(403).send('You must be logged in to delete your account.');

      await UserModel.deleteUser(req.session.user.user_id);
      req.session.destroy(err => {
        if (err) console.error('Session destroy error:', err);
        res.clearCookie('connect.sid');
        res.redirect('/user/register');
      });
    } catch (error) {
      console.error("❌ Account delete error:", error);
      res.status(500).send('Error deleting account');
    }
  },

  // ===============================
  // 📩 CONTACT FORM
  // ===============================
  sendQueryEmail: async (req, res) => {
    try {
      const { name, subject, message, email } = req.body;
      if (!name || !subject || !message || !email)
        return res.status(400).json({ error: "All fields are required" });

      const adminHtml = `
        <div style="font-family: Arial, sans-serif; padding:20px;">
          <h3>📩 New Query</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong> ${message}</p>
        </div>
      `;
      await sendUserMail(process.env.ADMIN_EMAIL, `New Query: ${subject}`, adminHtml);

      const userHtml = `
        <div style="font-family: Arial, sans-serif; padding:20px;">
          <h3>✅ Query Received</h3>
          <p>Hi ${name}, thanks for reaching out. We've received your query:</p>
          <p><strong>${subject}</strong></p>
          <p>${message}</p>
          <p>Our team will get back to you soon.</p>
        </div>
      `;
      await sendUserMail(email, "We received your query ✔", userHtml);

      res.status(200).json({ success: "Query sent successfully!" });
    } catch (error) {
      console.error("❌ Error sending query email:", error);
      res.status(500).json({ error: "Failed to send query" });
    }
  },

  /* ============================================================
     ✏️ UPDATE USER PROFILE
  ============================================================ */

  updateProfile: async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/user/login");

    const userId = req.session.user.user_id;
    const { email, name, surname, country, province, city, password } = req.body;
    const fieldsToUpdate = {};

    if (email) fieldsToUpdate.email = email;
    if (name) fieldsToUpdate.name = name;
    if (surname) fieldsToUpdate.surname = surname;
    if (country) fieldsToUpdate.country = country;
    if (province) fieldsToUpdate.province = province;
    if (city) fieldsToUpdate.city = city;

    // ✅ Handle profile photo (via Multer)
    if (req.file) {
      const imagePath = `/uploads/profile_photos/${req.file.filename}`;
      fieldsToUpdate.profile_photo = imagePath;

      // Optional cleanup of old photo
      if (
        req.session.user.profile_photo &&
        req.session.user.profile_photo !== "/images/default-avatar.png"
      ) {
        const oldPath = path.join(__dirname, "../public", req.session.user.profile_photo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    // ✅ Handle password
    if (password && password.trim() !== "") {
      fieldsToUpdate.password = await bcrypt.hash(password, 10);
    }

    // ✅ Update DB
    await UserModel.updateUser(userId, fieldsToUpdate);

    // ✅ Update session object
    Object.assign(req.session.user, fieldsToUpdate);

    console.log(`✅ User ${userId} updated their profile`);

    // ✅ Redirect based on role
    if (req.session.user.role === "ADMIN") {
      return res.redirect("/admin/dashboard?success=Profile updated successfully");
    } else {
      return res.redirect("/user/dashboard?success=Profile updated successfully");
    }

  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).render("error", { message: "Error updating profile" });
  }
},

};

module.exports = UserController;