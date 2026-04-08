const express = require('express');
const router = express.Router();
const billingController = require('../Controllers/billingController');
const { isAuthenticated } = require('../Middleware/auth');

// Get billing page
router.get('/billing', isAuthenticated, billingController.getBillingPage);

// Update subscription plan
router.post('/billing/update', isAuthenticated, billingController.updateSubscription);

// Get usage statistics
router.get('/billing/usage', isAuthenticated, billingController.getUsage);

module.exports = router;