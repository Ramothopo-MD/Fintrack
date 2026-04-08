const express = require("express");
const router = express.Router();
const SubscriptionPlanController = require("../Controllers/subscriptionPlanController");
const { isAuthenticated, isAdmin } = require("../Middleware/auth");

// 🧭 Admin: View all plans (renders page)
router.get("/manage-plans", isAuthenticated, isAdmin, SubscriptionPlanController.getAllPlans);

// 🧭 API Routes
router.get("/manage-plans/getall", isAuthenticated, isAdmin, SubscriptionPlanController.fetchPlans);
router.post("/manage-plans/create", isAuthenticated, isAdmin, SubscriptionPlanController.createPlan);
router.put("/manage-plans/:id", isAuthenticated, isAdmin, SubscriptionPlanController.updatePlan);
router.delete("/manage-plans/:id", isAuthenticated, isAdmin, SubscriptionPlanController.deletePlan);

module.exports = router;
