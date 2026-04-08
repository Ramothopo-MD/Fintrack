const express = require("express");
const router = express.Router();
const budgetController = require("../Controllers/budgetController");
const { isAuthenticated } = require("../Middleware/auth");

// Render the main budget page (EJS)
router.get("/page", isAuthenticated, budgetController.getBudgetPage);

// JSON API: all budgets
router.get("/", isAuthenticated, budgetController.getBudgets);

// Create a new budget
router.post("/", isAuthenticated, budgetController.createBudget);

// Update a budget
router.put("/:id", isAuthenticated, budgetController.updateBudget);

// Delete a budget
router.delete("/:id", isAuthenticated, budgetController.deleteBudget);

module.exports = router;
