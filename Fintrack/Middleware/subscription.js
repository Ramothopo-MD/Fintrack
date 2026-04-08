const pool = require("../Config/db");

// ✅ Check if user is subscribed (active or trial)
async function isSubscribed(req, res, next) {
  try {
    if (!req.session || !req.session.user) {
      return res.redirect("/user/login"); // not logged in
    }

    const userId = req.session.user.user_id;

    // query subscription table
    const [rows] = await pool.query(
      `SELECT * 
       FROM user_subscriptions 
       WHERE user_id = ? 
         AND status IN ('active','trial')
         AND CURDATE() BETWEEN start_date AND end_date
       ORDER BY end_date DESC 
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      // no active subscription
    return res.redirect("/plans/billing");
    }

    // attach subscription info to request for later use
    req.subscription = rows[0];
    return next();

  } catch (err) {
    console.error("Subscription check failed:", err);
    return res.status(500).send("Server error while checking subscription");
  }
}

module.exports = { isSubscribed };
