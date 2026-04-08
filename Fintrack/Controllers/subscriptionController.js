const paystackService = require('../Services/paystackService');
const SubscriptionPlanModel = require('../Models/subscription-plan');
const UserSubscriptionModel = require('../Models/userSubscriptionModel');

const subscriptionController = {
  // ✅ Display all available plans
  async getSubscriptionPlans(req, res) {
    console.log('\n==================== 🌍 GET /plans/choose ====================');
    try {
      const plans = await SubscriptionPlanModel.getAll();
      const user = req.session.user || null;

      res.render('User/choose-plan', {
        title: 'Choose Your Plan - FinTrack',
        plans,
        user
      });
    } catch (error) {
      console.error('❌ Error fetching plans:', error);
      res.status(500).render('error', { message: 'Unable to load subscription plans' });
    }
  },

  // ✅ Billing page
  async getBillingPage(req, res) {
    console.log('\n==================== 💼 GET /plans/billing ====================');
    try {
      const userId = req.session.user.user_id;

      const activeSubscription = await UserSubscriptionModel.getActiveSubscription(userId);
      const availablePlans = await SubscriptionPlanModel.getAll();
      const subscriptionHistory = await UserSubscriptionModel.getUserSubscriptions(userId);

      res.render('User/billing-page', {
        title: 'Billing & Subscription - FinTrack',
        activeSubscription,
        availablePlans,
        subscriptionHistory
      });
    } catch (error) {
      console.error('❌ Error loading billing page:', error);
      res.status(500).render('error', { message: 'Failed to load billing page' });
    }
  },

  // ✅ Subscribe to a plan
  async subscribeToPlan(req, res) {
    console.log('\n==================== 💳 POST /plans/subscribe ====================');
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/user/login');

      const { planId } = req.body;
      const plan = await SubscriptionPlanModel.getPlanById(planId);
      if (!plan) return res.status(404).render('error', { message: 'Plan not found' });

      const session = await paystackService.initializeSubscription(user, plan);
      if (!session || !session.authorization_url)
        return res.status(500).render('error', { message: 'Payment initialization failed.' });

      console.log(`➡️ Redirecting to Paystack: ${session.authorization_url}`);
      res.redirect(session.authorization_url);
    } catch (error) {
      console.error('❌ Error creating Paystack session:', error);
      res.status(500).render('error', { message: 'Payment initialization failed.' });
    }
  },

  // ✅ Verify payment callback
  async verifyPayment(req, res) {
    console.log('\n==================== 🔍 GET /plans/verify ====================');
    try {
      const { reference } = req.query;
      const result = await paystackService.verifyTransaction(reference);

      if (result.status === 'success') {
        const { plan_id, user_id } = result.metadata;

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        await UserSubscriptionModel.cancelSubscription(user_id);

        await UserSubscriptionModel.createSubscription({
          user_id,
          plan_id,
          status: 'active',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          trial_used: false,
          auto_renew: true
        });

        console.log('🎉 Subscription verified and activated!');
        return res.redirect('/plans/billing');
      }

      res.render('error', { message: 'Payment verification failed or cancelled.' });
    } catch (error) {
      console.error('❌ Payment verification error:', error);
      res.status(500).render('error', { message: 'Could not verify payment' });
    }
  },

  // ✅ Cancel subscription manually
  async cancelSubscription(req, res) {
    console.log('\n==================== ❌ POST /plans/cancel ====================');
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/user/login');

      const result = await UserSubscriptionModel.cancelSubscription(user.user_id);
      const message = result ? 'Your subscription has been cancelled.' : 'No active subscription found.';
      console.log(message);

      req.session.success = message;
      res.redirect('/plans/billing'); // ✅ FIX: route exists now
    } catch (error) {
      console.error('❌ Error cancelling subscription:', error);
      res.status(500).render('error', { message: 'Failed to cancel subscription' });
    }
  },

  // ✅ Upgrade an existing subscription
  async upgradePlan(req, res) {
    console.log('\n==================== 🔼 POST /plans/upgrade ====================');
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/user/login');

      const { newPlanId } = req.body;
      const current = await UserSubscriptionModel.getActiveSubscription(user.user_id);
      const newPlan = await SubscriptionPlanModel.getPlanById(newPlanId);

      if (!newPlan)
        return res.status(404).render('error', { message: 'Selected plan not found' });

      if (current && newPlan.price <= current.price) {
        return res.render('error', { message: 'You can only upgrade to a higher plan.' });
      }

      const session = await paystackService.initializeSubscription(user, newPlan);
      if (!session || !session.authorization_url)
        return res.status(500).render('error', { message: 'Payment initialization failed.' });

      console.log(`✅ Upgrade session created. Redirecting: ${session.authorization_url}`);
      res.redirect(session.authorization_url);
    } catch (error) {
      console.error('❌ Upgrade plan error:', error);
      res.status(500).render('error', { message: 'Failed to process upgrade request' });
    }
  }
};

module.exports = subscriptionController;
