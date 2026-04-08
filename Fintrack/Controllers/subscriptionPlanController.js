const SubscriptionPlanModel = require("../Models/subscription-plan");

const SubscriptionPlanController = {
  // ✅ Render all plans (Admin Page)
  async getAllPlans(req, res) {
    try {
      console.log("🔍 Loading all subscription plans for admin view...");
      const plans = await SubscriptionPlanModel.getAllPlans();
      res.render("Admin/manage-plans", {
        title: "Subscription Plans",
        user: req.session.user,
        plans,
      });
    } catch (error) {
      console.error("❌ Error loading plans:", error);
      res.status(500).render("error", { message: "Failed to load plans" });
    }
  },

  // ✅ Fetch all plans as JSON (API)
  async fetchPlans(req, res) {
    try {
      const plans = await SubscriptionPlanModel.getAllPlans();
      res.json({ success: true, data: plans });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Failed to fetch plans" });
    }
  },

  // ✅ Create new plan
  async createPlan(req, res) {
    try {
      const planData = {
        name: req.body.name,
        type: req.body.type,
        request_limit: req.body.request_limit,
        start_date: req.body.start_date || null,
        end_date: req.body.end_date || null,
        price: req.body.price,
        description: req.body.description,
        status: req.body.status || "active",
        created_by: req.session.user?.user_id || null,
      };
      console.log("🆕 Creating new plan with data:", planData);
      const newId = await SubscriptionPlanModel.createPlan(planData);
      console.log("✅ New plan created with ID:", newId);
      res.json({ success: true, message: "Plan created successfully", plan_id: newId });
    } catch (error) {
      console.error("❌ Error creating plan:", error);
      res.status(500).json({ success: false, message: "Failed to create plan" });
    }
  },

  // ✅ Edit / Update plan
  async updatePlan(req, res) {
    try {
      const planId = req.params.id;
      const data = {
        name: req.body.name,
        type: req.body.type,
        request_limit: req.body.request_limit,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        price: req.body.price,
        description: req.body.description,
        status: req.body.status,
      };
      const updatedPlan = await SubscriptionPlanModel.updatePlan(planId, data);

      if (updatedPlan)
        res.json({ success: true, message: "Plan updated successfully", data: updatedPlan });
      else
        res.status(404).json({ success: false, message: "Plan not found" });
    } catch (error) {
      console.error("❌ Error updating plan:", error);
      res.status(500).json({ success: false, message: "Failed to update plan" });
    }
  },

  // ✅ Delete a plan
  async deletePlan(req, res) {
    try {
      const { id } = req.params;
      const deleted = await SubscriptionPlanModel.deletePlan(id);
      if (deleted)
        res.json({ success: true, message: "Plan deleted successfully" });
      else
        res.status(404).json({ success: false, message: "Plan not found" });
    } catch (error) {
      console.error("❌ Error deleting plan:", error);
      res.status(500).json({ success: false, message: "Failed to delete plan" });
    }
  },
};

module.exports = SubscriptionPlanController;
