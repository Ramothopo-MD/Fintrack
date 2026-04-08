const BudgetModel = require("../Models/budgetModel");
const incomeModel = require("../Models/incomeModel");
const pool = require("../Config/db");

const budgetController = {
  // ✅ Initialize table
  async init() {
    await BudgetModel.createTable();
  },

  // ✅ JSON API: Get all budgets with detailed analytics
  async getBudgets(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const generalBudget = await BudgetModel.getGeneralBudget(userId);
      const categoryBudgets = await BudgetModel.getCategoryBudgets(userId);

      // ✅ Calculate total spent by category (based on receipt items)
      const [categorySpending] = await pool.query(
        `SELECT i.category, SUM(i.price * i.quantity) AS spent
         FROM receipt_items i
         JOIN receipts r ON i.receipt_id = r.receipt_id
         WHERE r.user_id = ?
         GROUP BY i.category`,
        [userId]
      );

      const totals = {};
      let totalSpent = 0;
      categorySpending.forEach(r => {
        const cat = r.category || "Uncategorized";
        totals[cat] = Number(r.spent) || 0;
        totalSpent += Number(r.spent) || 0;
      });

      // ✅ Get total income
      const income = await incomeModel.getIncome(userId);
      const totalIncome = income.reduce((sum, i) => sum + Number(i.amount), 0);

      // ✅ Calculate budget utilization
      const budgetUtilization = categoryBudgets.map(budget => {
        const spent = totals[budget.category] || 0;
        const allocated = Number(budget.amount) || 0;
        const utilization = allocated > 0 ? (spent / allocated) * 100 : 0;
        return {
          ...budget,
          spent,
          remaining: allocated - spent,
          utilization: Math.min(utilization, 100),
          status: utilization > 100 ? "over" : utilization > 80 ? "warning" : "good",
        };
      });

      // ✅ Monthly spending trend
      const [monthlyTrend] = await pool.query(
        `SELECT 
          DATE_FORMAT(date, '%Y-%m') as month,
          SUM(total) as monthly_total
         FROM receipts 
         WHERE user_id = ? 
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY month DESC
         LIMIT 6`,
        [userId]
      );

      // ✅ Return data
      res.json({
        generalBudget,
        categoryBudgets: budgetUtilization,
        totals,
        totalSpent,
        totalIncome,
        monthlyTrend: monthlyTrend.reverse(),
        analytics: {
          budgetUtilization:
            budgetUtilization.reduce((acc, curr) => acc + curr.utilization, 0) /
              budgetUtilization.length || 0,
          categoriesCount: categoryBudgets.length,
          overspentCategories: budgetUtilization.filter(b => b.status === "over").length,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching budgets:", error);
      res.status(500).json({ message: "Error fetching budgets" });
    }
  },

  // ✅ Render Budget Page (EJS) with complete data
  async getBudgetPage(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.redirect("/user/login");

      const generalBudget = await BudgetModel.getGeneralBudget(userId);
      const categoryBudgets = await BudgetModel.getCategoryBudgets(userId);

      // ✅ Get total spent
      const [spentRow] = await pool.query(
        `SELECT SUM(total) AS totalSpent FROM receipts WHERE user_id = ?`,
        [userId]
      );
      const totalSpent = spentRow[0]?.totalSpent ? Number(spentRow[0].totalSpent) : 0;

      // ✅ Category spending
      const [categorySpending] = await pool.query(
        `SELECT i.category, SUM(i.price * i.quantity) AS spent
         FROM receipt_items i
         JOIN receipts r ON i.receipt_id = r.receipt_id
         WHERE r.user_id = ?
         GROUP BY i.category`,
        [userId]
      );

      const totals = {};
      categorySpending.forEach(r => {
        const cat = r.category || "Uncategorized";
        totals[cat] = Number(r.spent) || 0;
      });

      // ✅ Income
      const income = await incomeModel.getIncome(userId);
      const totalIncome = income.reduce((sum, i) => sum + Number(i.amount), 0);

      // ✅ Balance
      const balance = totalIncome - (generalBudget ? Number(generalBudget.amount) : 0);

      // ✅ Category budgets with usage
      const categoryBudgetsWithUsage = categoryBudgets.map(budget => {
        const spent = totals[budget.category] || 0;
        const allocated = Number(budget.amount) || 0;
        const utilization = allocated > 0 ? (spent / allocated) * 100 : 0;
        return {
          ...budget,
          spent,
          remaining: allocated - spent,
          utilization: Math.min(utilization, 100),
          status:
            utilization > 100
              ? "over-budget"
              : utilization > 80
              ? "near-limit"
              : "within-budget",
        };
      });

      // ✅ Budget alerts (fixed call)
      const budgetAlerts = budgetController.generateBudgetAlerts(
        generalBudget,
        categoryBudgetsWithUsage,
        totalSpent,
        totalIncome
      );

      res.render("User/manage-budget", {
        user: req.session.user,
        generalBudget,
        categoryBudgets: categoryBudgetsWithUsage,
        totals,
        totalSpent,
        income,
        balance,
        totalIncome,
        budgetAlerts,
        success: req.query.success || null,
        error: req.query.error || null,
      });
    } catch (err) {
      console.error("❌ Error loading budget page:", err);
      res.render("error", { message: "Failed to load budget page" });
    }
  },

  // ✅ Generate budget alerts (independent, no `this`)
  generateBudgetAlerts(generalBudget, categoryBudgets, totalSpent, totalIncome) {
    const alerts = [];

    // 🚨 Over general budget
    if (generalBudget && totalSpent > Number(generalBudget.amount)) {
      alerts.push({
        type: "danger",
        icon: "exclamation-triangle",
        message: `You've exceeded your monthly budget by R ${(totalSpent -
          Number(generalBudget.amount)
        ).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
        priority: "high",
      });
    }

    // ⚠️ Category-level alerts
    categoryBudgets.forEach(budget => {
      const allocated = Number(budget.amount) || 0;
      const spent = Number(budget.spent) || 0;
      if (budget.status === "over-budget") {
        alerts.push({
          type: "warning",
          icon: "exclamation-circle",
          message: `Over budget in ${budget.category}: R ${spent.toLocaleString(
            "en-ZA",
            { minimumFractionDigits: 2 }
          )} spent vs R ${allocated.toLocaleString("en-ZA", {
            minimumFractionDigits: 2,
          })} allocated.`,
          priority: "medium",
        });
      } else if (budget.status === "near-limit") {
        alerts.push({
          type: "info",
          icon: "info-circle",
          message: `${budget.category} spending is nearing its limit: R ${spent.toLocaleString(
            "en-ZA",
            { minimumFractionDigits: 2 }
          )} of R ${allocated.toLocaleString("en-ZA", {
            minimumFractionDigits: 2,
          })}.`,
          priority: "low",
        });
      }
    });

    // 💡 Budget exceeds income
    if (generalBudget && Number(generalBudget.amount) > totalIncome) {
      alerts.push({
        type: "info",
        icon: "info-circle",
        message: `Your total budget exceeds your income by R ${(
          Number(generalBudget.amount) - totalIncome
        ).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}.`,
        priority: "medium",
      });
    }

    // ✅ Sort by priority
    return alerts.sort((a, b) => {
      const order = { high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    });
  },

  // ✅ Create new budget
  async createBudget(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.redirect("/user/login?error=Unauthorized");

      const { name, type, category, amount, period } = req.body;
      if (!name || !amount) {
        return res.redirect("/budget/page?error=Missing required fields");
      }

      if (Number(amount) <= 0) {
        return res.redirect("/budget/page?error=Budget amount must be greater than 0");
      }

      await BudgetModel.createBudget({
        user_id: userId,
        name,
        type: type || "GENERAL",
        category: category || null,
        amount,
        period: period || "MONTHLY",
      });

      res.redirect("/budget/page?success=Budget created successfully");
    } catch (error) {
      console.error("❌ Error creating budget:", error);
      res.redirect("/budget/page?error=Error creating budget");
    }
  },

  // ✅ Update budget
  async updateBudget(req, res) {
    try {
      const budgetId = req.params.id;
      const { amount, period, name } = req.body;

      if (Number(amount) <= 0) {
        return res.redirect("/budget/page?error=Budget amount must be greater than 0");
      }

      await BudgetModel.updateBudget(budgetId, { amount, period, name });
      res.redirect("/budget/page?success=Budget updated successfully");
    } catch (error) {
      console.error("❌ Error updating budget:", error);
      res.redirect("/budget/page?error=Error updating budget");
    }
  },

  // ✅ Delete budget
  async deleteBudget(req, res) {
    try {
      const budgetId = req.params.id;
      await BudgetModel.deleteBudget(budgetId);
      res.redirect("/budget/page?success=Budget deleted successfully");
    } catch (error) {
      console.error("❌ Error deleting budget:", error);
      res.redirect("/budget/page?error=Error deleting budget");
    }
  },

  // ✅ Get budget analytics (API)
  async getBudgetAnalytics(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [currentMonthSpending] = await pool.query(
        `SELECT i.category, SUM(i.price * i.quantity) AS spent
         FROM receipt_items i
         JOIN receipts r ON i.receipt_id = r.receipt_id
         WHERE r.user_id = ? 
           AND MONTH(r.date) = MONTH(CURRENT_DATE()) 
           AND YEAR(r.date) = YEAR(CURRENT_DATE())
         GROUP BY i.category`,
        [userId]
      );

      const [monthlyTrend] = await pool.query(
        `SELECT DATE_FORMAT(date, '%Y-%m') as month, SUM(total) as total_spent
         FROM receipts 
         WHERE user_id = ? 
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY month DESC
         LIMIT 12`,
        [userId]
      );

      const categoryBudgets = await BudgetModel.getCategoryBudgets(userId);
      const budgetVsActual = categoryBudgets.map(budget => {
        const spent =
          currentMonthSpending.find(s => s.category === budget.category)?.spent || 0;
        return {
          category: budget.category,
          budgeted: Number(budget.amount),
          spent: Number(spent),
          difference: Number(budget.amount) - Number(spent),
        };
      });

      res.json({
        currentMonthSpending,
        monthlyTrend: monthlyTrend.reverse(),
        budgetVsActual,
        summary: {
          totalCategories: categoryBudgets.length,
          totalBudgeted: categoryBudgets.reduce((sum, b) => sum + Number(b.amount), 0),
          totalSpent: currentMonthSpending.reduce(
            (sum, s) => sum + Number(s.spent),
            0
          ),
        },
      });
    } catch (error) {
      console.error("❌ Error fetching budget analytics:", error);
      res.status(500).json({ message: "Error fetching analytics" });
    }
  },

  // ✅ Create multiple category budgets
  async createCategoryBudgets(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { budgets } = req.body;
      if (!Array.isArray(budgets)) {
        return res.status(400).json({ message: "Budgets must be an array" });
      }

      const results = [];
      for (const budget of budgets) {
        if (budget.category && budget.amount > 0) {
          const result = await BudgetModel.createBudget({
            user_id: userId,
            name: `${budget.category} Budget`,
            type: "CATEGORY",
            category: budget.category,
            amount: budget.amount,
            period: "MONTHLY",
          });
          results.push(result);
        }
      }

      res.json({
        success: true,
        message: `Created ${results.length} category budgets`,
        results,
      });
    } catch (error) {
      console.error("❌ Error creating category budgets:", error);
      res.status(500).json({ message: "Error creating category budgets" });
    }
  },

  // ✅ Reset all budgets
  async resetBudgets(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.redirect("/user/login?error=Unauthorized");

      await BudgetModel.resetUserBudgets(userId);
      res.redirect("/budget/page?success=All budgets reset successfully");
    } catch (error) {
      console.error("❌ Error resetting budgets:", error);
      res.redirect("/budget/page?error=Error resetting budgets");
    }
  },

  // ✅ Export budget data
  async exportBudgetData(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // Call directly instead of using `this`
      const budgetData = await budgetController.getBudgets(req, res, true);
      const timestamp = new Date().toISOString().split("T")[0];

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="budget-export-${timestamp}.json"`
      );
      res.json(budgetData);
    } catch (error) {
      console.error("❌ Error exporting budget data:", error);
      res.status(500).json({ message: "Error exporting budget data" });
    }
  },
};

module.exports = budgetController;
