const ItemModel = require("../Models/itemsModel");
const ReceiptModel = require("../Models/receiptModel");

const itemController = {
  // CREATE item under a receipt
  async create(req, res) {
    try {
      const { receiptId } = req.params;
      const { name, price, category, quantity } = req.body;
      const itemId = await ItemModel.addItem(receiptId, { name, price, category, quantity });
      res.json({ success: true, itemId });
    } catch (err) {
      console.error("❌ Error creating item:", err);
      res.status(500).json({ error: "Failed to create item" });
    }
  },

  // READ all items for a receipt
  async getByReceipt(req, res) {
    try {
      const { receiptId } = req.params;
      const items = await ItemModel.getItemsByReceiptId(receiptId);
      res.json(items);
    } catch (err) {
      console.error("❌ Error fetching items:", err);
      res.status(500).json({ error: "Failed to fetch items" });
    }
  },
  async updateItems(req, res) {
  try {
    const { item_id } = req.params;
    const { name, price, category, quantity } = req.body;

    console.log("Updating item:", item_id, name, price, category, quantity);

    const updatedItem = await ItemModel.updateItem(item_id, {
      name,
      price,
      category,
      quantity,
    });

    if (!updatedItem) {
      console.log("⚠️ Item not found:", item_id);
      return res.redirect("/user/receipts/upload?error=Item not found");
    }

    console.log("✅ Item updated successfully:", updatedItem);

    // ✅ Redirect back to receipts page with success message
    return res.redirect("/user/receipts/upload?success=Item updated successfully");

  } catch (error) {
    console.error("❌ Error updating item:", error);
    return res.redirect("/user/receipts/upload?error=Failed to update item");
  }
}
,
// // ✅ Update multiple items for a receipt
// async updateItems(req, res) {
//   try {
//     const { receiptId } = req.params;
//     const { items } = req.body; // 👈 this contains the edited form data

//     if (!items || typeof items !== "object") {
//       return res.status(400).json({ error: "Invalid items payload" });
//     }

//     console.log("🛠 Updating items for receipt:", receiptId, items);

//     // ✅ Validate that the receipt exists
//     const receipt = await ReceiptModel.getReceiptById(receiptId);
//     if (!receipt) {
//       return res.status(404).json({ error: "Receipt not found" });
//     }

//     // ✅ Validate ownership
//     const user = req.session.user;
//     if (!user || (receipt.user_id !== user.user_id && user.role !== "ADMIN")) {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     // ✅ Update each item with the new values
//     const updatedItems = [];
//     for (const [itemId, itemData] of Object.entries(items)) {
//       const updated = await ItemModel.updateItem(itemId, itemData);
//       updatedItems.push(updated);
//     }

//     console.log(`✅ ${updatedItems.length} items updated successfully`);
//     res.redirect(
//       "/user/manage-receipts?success=" +
//         encodeURIComponent("Items updated successfully!")
//     );
//   } catch (err) {
//     console.error("❌ Error updating items:", err);
//     res.redirect(
//       "/user/manage-receipts?error=" +
//         encodeURIComponent("Failed to update items")
//     );
//   }
// }
// ,


 // ✅ Update single item
async update(req, res) {
  try {
    const { itemId } = req.params;
    const { name, price, category, quantity } = req.body;

    const updated = await ItemModel.updateItem(itemId, { name, price, category, quantity });

    console.log(`✅ Item updated successfully (ID: ${itemId})`);
    console.log("Updated item data:", updated);

    // Redirect with success message
    res.redirect("/user/receipts/upload?success=" + encodeURIComponent("Item updated successfully!"));
  } catch (err) {
    console.error("❌ Error updating item:", err);

    // Redirect with error message
    res.redirect("/user/receipts/upload?error=" + encodeURIComponent("Failed to update item."));
  }
}
,

  // DELETE single item
async delete(req, res) {
  try {
    const { itemId } = req.params;
    await ItemModel.deleteItem(itemId);
    console.log(`✅ Item deleted successfully (ID: ${itemId})`);
    res.redirect("/user/receipts/upload?success=Item+deleted+successfully");
  } catch (err) {
    console.error("❌ Error deleting item:", err);
    res.redirect("/user/receipts/upload?error=Failed+to+delete+item");
  }
}
,
  async bulkUpdate(req, res) {
  try {
    const { receiptId } = req.params;
    const items = req.body.items; // comes as { itemId: { name, price, quantity, category }, ... }

    if (!items || typeof items !== "object") {
      return res.status(400).json({ error: "Invalid items payload" });
    }

    // Loop through and update each item
    for (const [itemId, data] of Object.entries(items)) {
      await ItemModel.updateItem(itemId, data);
    }

    res.redirect("/user/manage-receipts"); // ✅ redirect back to receipts page
  } catch (err) {
    console.error("❌ Bulk update failed:", err);
    res.status(500).json({ message: "Failed to update items" });
  }
}

};


module.exports = itemController;
