const express = require('express');
const router = express.Router();
const subscriptionController = require('../Controllers/subscriptionController');
const {isAuthenticated} = require('../Middleware/auth'); // ✅ FIX: import correctly

// 🌍 View all available plans
router.get('/choose', subscriptionController.getSubscriptionPlans);

// 💳 Subscribe to a plan
router.post('/subscribe', isAuthenticated, subscriptionController.subscribeToPlan);

// 🔍 Verify Paystack payment
router.get('/verify', subscriptionController.verifyPayment);

// 🧾 Billing page (new!)
router.get('/billing', isAuthenticated, subscriptionController.getBillingPage);

// ❌ Cancel current subscription
router.post('/cancel', isAuthenticated, subscriptionController.cancelSubscription);

// 🔼 Upgrade to a higher plan
router.post('/upgrade', isAuthenticated, subscriptionController.upgradePlan);

module.exports = router;
