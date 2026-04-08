const BudgetModel = require("../Models/budgetModel");
const ExpenseModel = require("../Models/ExpenseModel");
const db = require("../Config/db");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BudgetService = {
  /**
   * Fetch all data for budget page
   */
  async getBudgetPageData(userId) {
    const generalBudget = await BudgetModel.getGeneralBudget(userId);
    const categoryBudgets = await BudgetModel.getCategoryBudgets(userId);

    // Calculate totals spent by category
    let totals = {};
    if (categoryBudgets.length > 0) {
      for (let b of categoryBudgets) {
        const spent = await ExpenseModel.getTotalByCategory(userId, b.category);
        totals[b.category] = spent;
      }
    }

    const income = await this.getIncome(userId);
    const balance = await this.getBalance(userId);

    return { generalBudget, categoryBudgets, totals, income, balance };
  },

  async getBudgets(userId) {
    const general = await BudgetModel.getGeneralBudget(userId);
    const categories = await BudgetModel.getCategoryBudgets(userId);
    return { general, categories };
  },

  async createBudget(userId, data) {
    const budgetId = await BudgetModel.createBudget({
      user_id: userId,
      name: data.name,
      type: data.type,
      category: data.category,
      amount: data.amount,
      period: data.period
    });
    return { id: budgetId, ...data };
  },

  async updateBudget(id, fields) {
    return BudgetModel.updateBudget(id, fields);
  },

  async deleteBudget(id) {
    return BudgetModel.deleteBudget(id);
  },

  /**
   * INCOME HANDLING
   */
  async setIncome(userId, amount) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS incomes (
        user_id INT PRIMARY KEY,
        amount DECIMAL(10,2) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    await db.query(
      `INSERT INTO incomes (user_id, amount) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [userId, amount]
    );
    return true;
  },

  async getIncome(userId) {
    const [rows] = await db.query("SELECT amount FROM incomes WHERE user_id = ?", [userId]);
    return rows.length > 0 ? rows[0].amount : 0;
  },

  async getBalance(userId) {
    const income = await this.getIncome(userId);
    const [rows] = await db.query(
      "SELECT SUM(amount) AS total FROM budgets WHERE user_id = ?",
      [userId]
    );
    const totalBudget = rows[0].total || 0;

    return {
      income,
      totalBudget,
      balance: income - totalBudget,
      status: income - totalBudget >= 0 ? "OK" : "OVER"
    };
  },

  /**
   * AI-POWERED BUDGET GENERATION
   */
  async generateAiBudget(userId, prompt) {
    const income = await this.getIncome(userId);
    const existingBudgets = await BudgetModel.getCategoryBudgets(userId);

    // Calculate current spending
    let spentData = {};
    if (existingBudgets.length > 0) {
      for (let b of existingBudgets) {
        const spent = await ExpenseModel.getTotalByCategory(userId, b.category);
        spentData[b.category] = spent;
      }
    }

    const aiPrompt = `
You are a South African financial planner. 
The user earns R${income} per month.

Current budgets:
${JSON.stringify(existingBudgets, null, 2)}

Current spending:
${JSON.stringify(spentData, null, 2)}

Task:
1. Analyse how the user is budgeting and spending.
2. Suggest an improved, realistic monthly budget split (Rent, Groceries, Transport, Utilities, Entertainment, Savings, Airtime/Data, Clothing, Education).
3. Make sure total budget <= income.
4. Give advice about whether they are overspending or saving well.
5. Return ONLY valid JSON.

Schema:
{
  "income": number,
  "suggestedBudgets": [
    { "name": "string", "amount": number, "category": "string", "period": "MONTHLY" }
  ],
  "advice": "string"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a financial assistant. Return strict JSON only." },
        { role: "user", content: aiPrompt }
      ],
      temperature: 0.2
    });

    return JSON.parse(completion.choices[0].message.content);
  }
};

module.exports = BudgetService;
