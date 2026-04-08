// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const UserController = require("../Controllers/userController");
const { isAuthenticated, isAdmin } = require("../Middleware/auth");
const { isSubscribed } = require("../Middleware/subscription");

/* ============================================================
   📸 MULTER SETUP — For profile photo uploads
   ============================================================ */

// ✅ Ensure upload directory exists
const uploadDir = path.join(__dirname, "../public/uploads/profile_photos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`;
    cb(null, uniqueName);
  },
});

// ✅ File filter (restrict types)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();
  if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPG, PNG, WEBP) are allowed!"));
  }
};

// ✅ Multer instance
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // max 3MB
  fileFilter,
});

/* ============================================================
   🔐 AUTH PAGES
   ============================================================ */
router.get("/login", UserController.getLoginPage);
router.get("/register", UserController.getRegisterPage);

/* ============================================================
   🧍 AUTH ACTIONS
   ============================================================ */
router.post("/register", UserController.createAccount);
router.post("/login", UserController.login);
router.post("/logout", UserController.logout);

/* ============================================================
   🏠 DASHBOARD / HOME (Protected)
   ============================================================ */
router.get(
  "/dashboard",
  isAuthenticated,
  isSubscribed,
  UserController.renderHomePage
);

/* ============================================================
   🧾 RECEIPTS (Protected)
   ============================================================ */
router.get("/receipts/upload", isAuthenticated, UserController.getUploadPage);

/* ============================================================
   💰 BUDGET (Protected)
   ============================================================ */
router.get("/budget", isAuthenticated, UserController.getBudgetPage);

/* ============================================================
   🤖 AI PREDICTIONS (Protected)
   ============================================================ */
router.get("/ai-predictions", isAuthenticated, UserController.getAIPredictions);

/* ============================================================
   👤 ACCOUNT MANAGEMENT (Profile Update + Photo Upload)
   ============================================================ */
// 🗑️ Delete account
router.delete("/delete", isAuthenticated, UserController.deleteAccount);

// 🧍‍♂️ Update profile info + upload photo
router.post(
  "/profile/update",
  isAuthenticated,
  upload.single("profile_photo"), // ✅ Handles file upload field
  UserController.updateProfile
);

/* ============================================================
   📩 CONTACT FORM
   ============================================================ */
router.post("/contact", UserController.sendQueryEmail);

module.exports = router;
