const axios = require("axios");
const pool = require("../Config/db");

/**
 * Uses DeepSeek to predict future monthly spending and store-based trends.
 * @param {number} userId
 * @param {number} monthsToPredict
 */
async function generateDeepseekPredictions(userId, monthsToPredict = 3) {
  try {
    // 1️⃣ Fetch user historical monthly spending
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') AS month, 
        SUM(total) AS total_spent
      FROM receipts
      WHERE user_id = ?
      GROUP BY month
      ORDER BY month ASC
    `, [userId]);

    const historicalData = rows.map(r => ({
      month: r.month,
      total_spent: parseFloat(r.total_spent)
    }));

    // 2️⃣ Fetch total spending by store
    const [storeRows] = await pool.query(`
      SELECT store_name, SUM(total) AS total_spent
      FROM receipts
      WHERE user_id = ?
      GROUP BY store_name
      ORDER BY total_spent DESC
    `, [userId]);

    const storeTotals = storeRows.map(s => ({
      store: s.store_name || "Unknown",
      total_spent: parseFloat(s.total_spent)
    }));

    // Fallback if user has no data
    if (historicalData.length === 0 && storeTotals.length === 0) {
      return {
        monthlyForecast: [],
        storeForecast: [],
        insights: ["No spending data available for predictions."]
      };
    }

    // 3️⃣ Build AI prompt
    const prompt = `
You are an AI financial forecaster. 
Based on the user's historical monthly spending and store spending below, predict the next ${monthsToPredict} months.

Tasks:
1. Predict future monthly spending totals (ZAR).
2. Suggest predicted spending per store (Rands).
3. Include a short list of 3 key insights or warnings.

Return ONLY valid JSON in this format:
{
  "monthlyForecast": [
    {"month": "2025-08", "total_spent": 1200.55},
    {"month": "2025-09", "total_spent": 1350.00},
    {"month": "2025-10", "total_spent": 1420.75}
  ],
  "storeForecast": [
    {"store": "Shoprite", "predicted_spent": 950.00},
    {"store": "Boxer", "predicted_spent": 700.00},
    {"store": "Checkers", "predicted_spent": 680.00}
  ],
  "insights": [
    "Grocery spending is increasing steadily.",
    "Shoprite remains your top spending location.",
    "Consider reducing weekend purchases to save."
  ]
}

Historical monthly spending:
${JSON.stringify(historicalData, null, 2)}

Store spending summary:
${JSON.stringify(storeTotals, null, 2)}
`;

    // 4️⃣ Call DeepSeek API
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are an AI that outputs pure JSON forecasts." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000 // prevent hanging
      }
    );

    // 5️⃣ Parse response safely
    let data = response.data.choices?.[0]?.message?.content;
    if (!data) throw new Error("Empty response from DeepSeek");

    // If response is stringified JSON
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    return data;

  } catch (err) {
    console.error("DeepSeek Prediction Error:", err);
    throw new Error("Failed to generate AI predictions");
  }
}

module.exports = { generateDeepseekPredictions };
