require("dotenv").config();
const open = require("open");
const express = require("express");
const path = require("path");
const fs = require("fs");
const pool = require("./Config/db");
const session = require("express-session");
const methodOverride = require("method-override");

const { loadUserStats } = require("./Middleware/stats");

// 🧩 Routes
const complaintsRoutes = require("./Routes/complaintsRoute");
const receiptRoutes = require("./Routes/receiptRoute");
const userRoutes = require("./Routes/userRoute");
const itemsRoutes = require("./Routes/itemsRoute");
const subscriptionRoutes = require("./Routes/subscriptionRoute");
const billingRoutes = require("./Routes/billingRoute");
const budgetRoutes = require("./Routes/budgetRoute");
const incomeRoutes = require("./Routes/incomeRoute");
const adminRoutes = require("./Routes/adminRoute");
const announcementRoutes = require("./Routes/announcementRoute");
const subscriptionPlanRouter = require("./Routes/subscriptionPlanRoute");

// 🧩 Controllers
const UserController = require("./Controllers/userController");

// 🧩 Models
const ReceiptModel = require("./Models/receiptModel");
const ItemModel = require("./Models/itemsModel");
const OcrTextModel = require("./Models/ocrTextModel");
const UserSubscriptionModel = require("./Models/userSubscriptionModel");
const SubscriptionPlanModel = require("./Models/subscription-plan");
const UserModel = require("./Models/userModel");
const BudgetModel = require("./Models/budgetModel");
const IncomeModel = require("./Models/incomeModel");
const ComplaintModel = require("./Models/complaintsModel");
const AnnouncementModel = require("./Models/announcementModel");

const app = express();
const port = process.env.PORT || 2020;

/* ============================================================
   ⚙️ VIEW ENGINE
   ============================================================ */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* ============================================================
   🧩 CORE MIDDLEWARE
   ============================================================ */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

/* ============================================================
   📁 STATIC FILES
   ============================================================ */
const publicPath = path.join(__dirname, "public");
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}
app.use(express.static(publicPath));
console.log("✅ Serving static files from:", publicPath);

/* ============================================================
   🔐 SESSION CONFIG
   ============================================================ */
app.set("trust proxy", 1);
app.use(
  session({
    name: "fintrack.sid",
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

/* ============================================================
   📊 USER STATS + GLOBAL INJECTION
   ============================================================ */
app.use(loadUserStats);
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

/* ============================================================
   🏠 PUBLIC ROUTES
   ============================================================ */
app.get("/", async (req, res) => {
  try {
    // Fetch all active subscription plans
    const [plans] = await pool.query(
      "SELECT * FROM subscription_plans WHERE status = 'active' ORDER BY price ASC"
    );

    // Count total users
    const [[{ total_users }]] = await pool.query(
      "SELECT COUNT(*) AS total_users FROM users"
    );

    res.render("index", {
      user: req.session.user || null,
      plans,
      total_users,
    });
  } catch (err) {
    console.error("❌ Error loading homepage:", err);
    res.render("index", {
      user: req.session.user || null,
      plans: [],
      total_users: 0,
    });
  }
});

app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.get("/login", UserController.getLoginPage);
app.get("/register", UserController.getRegisterPage);
app.post("/login", UserController.login);
app.post("/register", UserController.createAccount);
app.post("/contact", UserController.sendQueryEmail);

/* ============================================================
   🚦 MAIN APP ROUTES
   ============================================================ */
app.use("/api", receiptRoutes);
app.use("/user", userRoutes);
app.use("/budget", budgetRoutes);
app.use("/manage-income", incomeRoutes);
app.use("/items", itemsRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/plans", billingRoutes);
app.use("/admin", adminRoutes);
app.use("/complaints", complaintsRoutes);
app.use("/announcements", announcementRoutes);
app.use("/plan", subscriptionPlanRouter);

/* ============================================================
   ❌ ERROR HANDLING
   ============================================================ */
app.use((req, res) => {
  res.status(404).render("error", {
    message: "Page not found",
    error: { status: 404 },
  });
});
/* ============================================================
   💬 FLASH-LIKE SESSION MESSAGES
   ============================================================ */
app.use((req, res, next) => {
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});
app.use((err, req, res, next) => {
  console.error("💥 Global error handler:", err);
  res.status(500).render("error", {
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

/* ============================================================
   🗄️ DATABASE INIT + SERVER START
   ============================================================ */
async function initAndStart() {
  try {
    console.log("🛠️  Initializing database tables...");

    await UserModel.createTable();
    await ReceiptModel.createTables();
    await ItemModel.createTable();
    await OcrTextModel.createTable();
    await SubscriptionPlanModel.createTable();
    await BudgetModel.createTable();
    await IncomeModel.createTable();
    await UserSubscriptionModel.createTable();
    await ComplaintModel.createTable();
    await AnnouncementModel.createTable();

    console.log("🎉 All tables successfully initialized");

    const server = app.listen(port, async () => {
      console.log(`🚀 FinTrack server running on http://localhost:${port}`);
      try {
        await open(`http://localhost:${port}`);
      } catch {
        console.log("⚠️ Could not open browser automatically.");
      }
    });
  } catch (e) {
    console.error("❌ DB initialization failed:", e);
    process.exit(1);
  }
}

initAndStart();
