const pool = require("../Config/db");
const ReceiptModel = require("../Models/receiptModel");
const ItemModel = require("../Models/itemsModel");
const OcrTextModel = require("../Models/ocrTextModel");
const UserSubscriptionModel = require("../Models/userSubscriptionModel");
const SubscriptionPlanModel = require("../Models/subscription-plan");
const { extractText, parseReceiptText } = require("../Services/receiptService");
const { findDuplicateOcr, hashOcr } = require("../Services/fuzzyServices");

const receiptController = {
  // ✅ CREATE receipt manually (API-style)
  async create(req, res) {
    try {
      if (!req.session.user) {
        return res.status(403).json({ error: "You must be logged in" });
      }

      const { receiptData, ocrText } = req.body;
      const userId = req.session.user.user_id;

      console.log("🧾 Creating receipt manually for user:", userId);

      const receiptId = await ReceiptModel.saveReceipt(receiptData, userId);

      // Save items
      for (const item of receiptData.items || []) {
        await ItemModel.addItem(receiptId, item);
      }

      // Save OCR text (optional)
      if (ocrText) {
        await OcrTextModel.saveOcrText(receiptId, ocrText);
      }

      // Fetch saved record for confirmation
      const saved = await ReceiptModel.getReceiptById(receiptId);
      saved.items = await ItemModel.getItemsByReceiptId(receiptId);
      saved.ocrText = await OcrTextModel.getOcrByReceiptId(receiptId);

      console.log("✅ Manual receipt created successfully:", receiptId);
      res.status(201).json({ success: true, receipt: saved });
    } catch (err) {
      console.error("❌ Error creating receipt:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ✅ PARSE uploaded receipt image (subscription-aware)
async parseReceipt(req, res) {
  try {
    if (!req.session.user) {
      return res.redirect("/user/login");
    }

    const userId = req.session.user.user_id;
    if (!req.file) {
      return res.redirect("/user/receipts/upload?error=" + encodeURIComponent("No image uploaded."));
    }

    console.log("🧾 Starting receipt parsing for user:", userId);

    // 1️⃣ Get active subscription
    const activeSub = await UserSubscriptionModel.getActiveSubscription(userId);
    if (!activeSub) {
      console.warn("⚠️ No active subscription found for user:", userId);
      return res.redirect("/plans/billing");
    }

    // 2️⃣ Get the linked plan for safety checks
    const plan = await SubscriptionPlanModel.getPlanById(activeSub.plan_id);
    if (!plan) {
      console.error("❌ Linked plan not found for user subscription:", activeSub.plan_id);
      return res.redirect("/plans/billing");
    }

    console.log("✅ Active subscription & plan:", {
      plan_name: plan.name,
      plan_limit: plan.request_limit,
      sub_limit: activeSub.request_limit,
      used: activeSub.requests_used,
    });

    // 3️⃣ Validate usage against BOTH plan and subscription limits
    const used = Number(activeSub.requests_used || 0);
    const subLimit = Number(activeSub.request_limit || 0);
    const planLimit = Number(plan.request_limit || 0);

    if (used >= subLimit || used >= planLimit) {
      console.warn("🚫 User exceeded limit:", { userId, used, subLimit, planLimit });

      await pool.query(
        "UPDATE user_subscriptions SET status = 'expired' WHERE user_subscription_id = ?",
        [activeSub.user_subscription_id]
      );

      return res.redirect("user/receipts/upload" + encodeURIComponent("You have reached your plan’s upload limit. Please upgrade your subscription."));
    }

    // 4️⃣ OCR Extraction
    console.log("Extracting text from uploaded image...");
    const ocrText = await extractText(req.file.buffer);
    req.file.buffer = null;

    // 5️⃣ Duplicate check
    console.log(" Checking for duplicate OCR text...");
    const existingOcrs = await OcrTextModel.getOcrByUser(userId);
    const duplicateCheck = findDuplicateOcr(ocrText, existingOcrs);
    if (duplicateCheck.duplicate) {
      console.warn("⚠️ Duplicate detected:", duplicateCheck.reason);
      return res.redirect("/user/receipts/upload?error=" + encodeURIComponent(duplicateCheck.reason));
    }

    // 6️⃣ AI Parsing
    console.log("Parsing receipt text with AI...");
    const receiptData = await parseReceiptText(ocrText);

    // 7️⃣ Save receipt
    console.log("Saving receipt...");
    const receiptId = await ReceiptModel.saveReceipt(receiptData, userId);

    // 8️⃣ Save items
    console.log(" Adding receipt items...");
    for (const item of receiptData.items || []) {
      await ItemModel.addItem(receiptId, {
        ...item,
        quantity: item.quantity ?? 1,
        category: item.category ?? "Uncategorized"
      });
    }

    // 9️⃣ Save OCR text + hash
    console.log(" Storing OCR text + hash...");
    await OcrTextModel.saveOcrText(receiptId, ocrText, hashOcr(ocrText));

    // 🔟 Increment usage counter
    console.log("Incrementing request usage...");
    await UserSubscriptionModel.incrementUsage(activeSub.user_subscription_id);

    console.log(` Request usage: ${used + 1}/${Math.min(subLimit, planLimit)} for user ${userId}`);

    // ✅ Success redirect
    return res.redirect("/user/receipts/upload?success=" + encodeURIComponent("Receipt uploaded successfully!"));
  } catch (err) {
    console.error("❌ Error parsing receipt:", err);
    return res.redirect("/user/receipts/upload?error=" + encodeURIComponent(err.message || "Error processing receipt."));
  }
},

  // ✅ READ all receipts (API)
  async getAll(req, res) {
    try {
      if (!req.session.user) {
        return res.status(403).json({ error: "You must be logged in" });
      }

      const [rows] = await pool.query(
        "SELECT * FROM receipts WHERE user_id = ? ORDER BY created_at DESC",
        [req.session.user.user_id]
      );

      console.log("📦 Retrieved", rows.length, "receipts for user", req.session.user.user_id);
      res.json(rows);
    } catch (err) {
      console.error("❌ Error fetching receipts:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ✅ READ one receipt
  async getById(req, res) {
    try {
      const id = req.params.id;
      const receipt = await ReceiptModel.getReceiptById(id);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      receipt.items = await ItemModel.getItemsByReceiptId(id);
      receipt.ocrText = await OcrTextModel.getOcrByReceiptId(id);

      console.log("📄 Viewing receipt:", id);
      res.json(receipt);
    } catch (err) {
      console.error("❌ Error fetching receipt by ID:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ✅ UPDATE receipt
  async update(req, res) {
    try {
      const id = req.params.id;
      await ReceiptModel.updateReceipt(id, req.body);
      console.log("✏️ Updated receipt:", id);
      res.redirect("/user/receipts/upload?success=" + encodeURIComponent("Receipt updated successfully!"));
    } catch (err) {
      console.error("❌ Error updating receipt:", err);
      res.redirect("/user/receipts/upload?error=" + encodeURIComponent(err.message));
    }
  },

  // ✅ DELETE receipt
  async delete(req, res) {
    try {
      const id = req.params.id;
      await ReceiptModel.deleteReceipt(id);
      console.log("🗑️ Deleted receipt:", id);
      res.redirect("/user/receipts/upload?success=" + encodeURIComponent("Receipt deleted successfully!"));
    } catch (err) {
      console.error("❌ Error deleting receipt:", err);
      res.redirect("/user/receipts/upload?error=" + encodeURIComponent(err.message));
    }
  }
};

module.exports = receiptController;
