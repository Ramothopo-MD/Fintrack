const IncomeModel = require("../Models/incomeModel");

const incomeController = {
  // ✅ Create or set income for a user
  async createIncome(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.redirect("/user/login?error=Unauthorized");

      const { amount, source } = req.body;

      if (!amount || amount <= 0) {
        return res.redirect("/user/budget?error=Invalid income amount");
      }
      if (!source || source.trim() === "") {
        return res.redirect("/user/budget?error=Income source is required");
      }

      await IncomeModel.createIncome(userId, amount, source);
      return res.redirect("/user/budget?success=Income set successfully");
    } catch (err) {
      console.error("❌ Error creating income:", err);
      return res.redirect("/user/budget?error=Server error while setting income");
    }
  },

  // ✅ Update income (amount + source)
  async updateIncome(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.redirect("/user/login?error=Unauthorized");

      const { amount, source } = req.body;

      if (!amount || amount <= 0) {
        return res.redirect("/user/budget?error=Invalid income amount");
      }
      if (!source || source.trim() === "") {
        return res.redirect("/user/budget?error=Income source is required");
      }

      const updated = await IncomeModel.updateIncome(userId, amount, source);
      if (!updated) {
        return res.redirect("/user/budget?error=Income record not found");
      }

      return res.redirect("/user/budget?success=Income updated successfully");
    } catch (err) {
      console.error("❌ Error updating income:", err);
      return res.redirect("/user/budget?error=Server error while updating income");
    }
  },

  // ✅ Delete income
  async deleteIncome(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.redirect("/user/login?error=Unauthorized");

      const deleted = await IncomeModel.deleteIncome(userId);
      if (!deleted) {
        return res.redirect("/user/budget?error=Income record not found");
      }

      return res.redirect("/user/budget?success=Income deleted successfully");
    } catch (err) {
      console.error("❌ Error deleting income:", err);
      return res.redirect("/user/budget?error=Server error while deleting income");
    }
  },

  // ✅ Get income for logged-in user (API/debug use only)
  async getIncome(req, res) {
    try {
      const userId = req.session.user?.user_id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const income = await IncomeModel.getIncome(userId);
      if (!income) {
        return res.status(404).json({ message: "No income set yet" });
      }

      res.json(income);
    } catch (err) {
      console.error("❌ Error fetching income:", err);
      res.status(500).json({ message: "Server error while fetching income" });
    }
  },

  // ✅ Get all incomes (admin/debug use only)
  async getAllIncomes(req, res) {
    try {
      const incomes = await IncomeModel.getAllIncomes();
      res.json(incomes);
    } catch (err) {
      console.error("❌ Error fetching all incomes:", err);
      res.status(500).json({ message: "Server error while fetching incomes" });
    }
  },
};

module.exports = incomeController;
