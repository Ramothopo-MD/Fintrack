// Services/paystackService.js
require('dotenv').config();
const axios = require('axios');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystackService = {
  async initializeSubscription(user, plan) {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: plan.price * 100, // Paystack expects kobo
        currency: 'ZAR', // You can use NGN if your account supports it
        callback_url: `${process.env.DOMAIN}/subscriptions/verify`,
        metadata: {
          user_id: user.user_id,
          plan_id: plan.plan_id,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  },

  async verifyTransaction(reference) {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    return response.data.data;
  },
};

module.exports = paystackService;
