const BudgetModel = require("../Models/budgetModel");
const ReceiptModel = require("../Models/receiptModel");
const UserModel = require("../Models/userModel");

/**
 * ✅ USER STATS MIDDLEWARE
 * Injects budget progress and total spent into res.locals for EJS.
 */
async function loadUserStats(req, res, next) {
  try {
    // Always expose user to EJS
    res.locals.user = req.session?.user || null;

    // Default stats (avoid undefined errors)
    res.locals.stats = {
      budgetProgress: 0,
      budget: 0,
      totalSpent: 0,
    };

    // ✅ Only calculate if logged in
    if (req.session?.user) {
      const userId = req.session.user.user_id;

      // ✅ Fetch general budget
      const generalBudget = await BudgetModel.getGeneralBudget(userId);
      const budget = generalBudget ? Number(generalBudget.amount) : 0;

      // ✅ Calculate total spent from receipts
      const receipts = await ReceiptModel.getAllByUserWithItems(userId);
      const totalSpent = receipts.reduce(
        (sum, r) => sum + (Number(r.total) || 0),
        0
      );

      // ✅ Compute progress (cap at 100%)
      const budgetProgress =
        budget > 0 ? Math.min(((totalSpent / budget) * 100).toFixed(0), 100) : 0;

      // ✅ Inject into all EJS views
      res.locals.stats = {
        budgetProgress,
        budget,
        totalSpent,
      };
    }

    next();
  } catch (error) {
    console.error("❌ Error in user stats middleware:", error);
    res.locals.stats = { budgetProgress: 0, budget: 0, totalSpent: 0 };
    next();
  }
}
/**
 * ✅ ADMIN STATS MIDDLEWARE
 * Fetches platform-wide metrics for the admin dashboard.
 */
async function loadAdminStats(req, res, next) {
  try {
    // Always expose the logged-in user to templates
    res.locals.user = req.session?.user || null;

    // Default stats in case something fails
    res.locals.adminStats = {
      totalUsers: 0,
      totalReceipts: 0,
      totalBudgets: 0,
      totalIncomes: 0,
      totalComplaints: 0,
      totalActiveSubscriptions: 0,
      totalPlans: 0,
      totalSpent: 0,
    };

    // ✅ Only calculate stats if an admin is logged in
    if (req.session?.user && req.session.user.role === "ADMIN") {
      // 1️⃣ Users
      const users = await UserModel.getAllUsers();
      const totalUsers = users.length;

      // 2️⃣ Receipts
      const receipts = await ReceiptModel.getAllReceipts();
      const totalReceipts = receipts.length;
      const totalSpent = receipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

      // 3️⃣ Budgets
      const [budgets] = await Promise.all([BudgetModel.getBudgetsByUser ? [] : []]); // placeholder (getAll not defined)
      const totalBudgets = 0; // You can add getAllBudgets() later if you add that function

      // 4️⃣ Incomes
      const incomes = await IncomeModel.getAllIncomes();
      const totalIncomes = incomes.length;

      // 5️⃣ Complaints
      const complaints = await ComplaintModel.getAll(100);
      const totalComplaints = complaints.length;

      // 6️⃣ Subscriptions
      const totalActiveSubscriptions = await UserSubscriptionModel.getActiveSubscriptionsCount();

      // 7️⃣ Plans
      const plans = await SubscriptionPlanModel.getAllPlans();
      const totalPlans = plans.length;

      // ✅ Inject computed stats
      res.locals.adminStats = {
        totalUsers,
        totalReceipts,
        totalBudgets,
        totalIncomes,
        totalComplaints,
        totalActiveSubscriptions,
        totalPlans,
        totalSpent,
      };
    }

    next();
  } catch (error) {
    console.error("❌ Error in admin stats middleware:", error);
    // Ensure safe defaults on failure
    res.locals.adminStats = {
      totalUsers: 0,
      totalReceipts: 0,
      totalBudgets: 0,
      totalIncomes: 0,
      totalComplaints: 0,
      totalActiveSubscriptions: 0,
      totalPlans: 0,
      totalSpent: 0,
    };
    next();
  }
}

module.exports = { loadUserStats ,loadAdminStats};
