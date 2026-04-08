// Controllers/billingController.js
const paystackService = require("../Services/paystackService");
const SubscriptionPlanModel = require("../Models/subscription-plan");
const UserSubscriptionModel = require("../Models/userSubscriptionModel");

const billingController = {
  /**
   * ✅ Render Billing Page
   * Shows active subscription, usage, and history.
   */
  async getBillingPage(req, res) {
    console.log("\n==================== 💼 GET /plans/billing ====================");
    try {
      const user = req.session.user;
      if (!user) return res.redirect("/user/login");

      const userId = user.user_id;
      const activeSubscription = await UserSubscriptionModel.getActiveSubscription(userId);
      const availablePlans = await SubscriptionPlanModel.getAll();
      const subscriptionHistory = await UserSubscriptionModel.getUserSubscriptions(userId);

      // If user has no active subscription → redirect to choose plan page
      if (!activeSubscription) {
        return res.render("User/choose-plan", {
          title: "Choose a Subscription Plan - FinTrack",
          plans: availablePlans,
          user,
          message: "You don’t have an active subscription yet — please select one below."
        });
      }

      // Otherwise → render Billing Page
      res.render("User/billing-page", {
        title: "Billing & Subscription - FinTrack",
        activeSubscription,
        availablePlans,
        subscriptionHistory,
        user
      });
    } catch (error) {
      console.error("❌ Error loading billing page:", error);
      res.status(500).render("error", { message: "Failed to load billing page" });
    }
  },

  /**
   * ✅ Upgrade or Change Subscription Plan
   * Redirects user to Paystack checkout.
   */
  async updateSubscription(req, res) {
    console.log("\n==================== 💳 POST /plans/billing/update ====================");
    try {
      const user = req.session.user;
      if (!user) return res.redirect("/user/login");

      const { planId } = req.body;
      const plan = await SubscriptionPlanModel.getPlanById(planId);

      if (!plan) {
        return res.status(404).render("error", { message: "Selected plan not found" });
      }

      // ✅ Initialize Paystack transaction
      const session = await paystackService.initializeSubscription(user, plan);
      if (!session || !session.authorization_url) {
        console.error("❌ Paystack init failed:", session);
        return res.status(500).render("error", { message: "Payment initialization failed." });
      }

      console.log(`➡️ Redirecting user (${user.email}) to Paystack: ${session.authorization_url}`);
      return res.redirect(session.authorization_url);
    } catch (error) {
      console.error("❌ Error updating subscription:", error);
      res.status(500).render("error", { message: "Failed to process payment" });
    }
  },

  /**
   * ✅ Verify Paystack Payment
   * Confirms the transaction and activates subscription.
   */
  async verifyPayment(req, res) {
    console.log("\n==================== 🔍 GET /plans/verify ====================");
    try {
      const { reference } = req.query;
      if (!reference) {
        return res.redirect(
          "/plans/billing?error=" + encodeURIComponent("Invalid payment reference.")
        );
      }

      const result = await paystackService.verifyTransaction(reference);

      if (result.status === "success") {
        const { plan_id, user_id } = result.metadata;

        // Cancel any current plan
        await UserSubscriptionModel.cancelSubscription(user_id);

        // Create new active subscription
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        await UserSubscriptionModel.createSubscription({
          user_id,
          plan_id,
          status: "active",
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          trial_used: false,
          auto_renew: true
        });

        console.log("🎉 Subscription verified and activated!");
        return res.redirect(
          "/plans/billing?success=" +
            encodeURIComponent("Subscription upgraded successfully!")
        );
      }

      res.redirect(
        "/plans/billing?error=" +
          encodeURIComponent("Payment verification failed or cancelled.")
      );
    } catch (error) {
      console.error("❌ Payment verification error:", error);
      res.redirect(
        "/plans/billing?error=" +
          encodeURIComponent("Could not verify payment.")
      );
    }
  },

  /**
   * ✅ Cancel active subscription manually
   */
  async cancelSubscription(req, res) {
    console.log("\n==================== ❌ POST /plans/cancel ====================");
    try {
      const user = req.session.user;
      if (!user) return res.redirect("/user/login");

      const result = await UserSubscriptionModel.cancelSubscription(user.user_id);
      const message = result
        ? "Your subscription has been cancelled."
        : "No active subscription found.";

      console.log(message);
      return res.redirect(
        "/plans/billing?success=" + encodeURIComponent(message)
      );
    } catch (error) {
      console.error("❌ Error cancelling subscription:", error);
      res.status(500).render("error", { message: "Failed to cancel subscription" });
    }
  },

  /**
   * ✅ API: Get usage stats for current plan
   */
  async getUsage(req, res) {
    try {
      const user = req.session.user;
      if (!user)
        return res.status(401).json({ success: false, message: "Unauthorized" });

      const activeSubscription = await UserSubscriptionModel.getActiveSubscription(
        user.user_id
      );

      if (!activeSubscription)
        return res
          .status(404)
          .json({ success: false, message: "No active subscription found" });

      const used = Number(activeSubscription.requests_used || 0);
      const total = Number(activeSubscription.request_limit || 0);
      const remaining = Math.max(total - used, 0);
      const percentage = total > 0 ? ((used / total) * 100).toFixed(1) : "0.0";

      res.json({
        success: true,
        usage: { used, total, remaining, percentage }
      });
    } catch (error) {
      console.error("❌ Error fetching usage:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch usage data" });
    }
  }
};

module.exports = billingController;
