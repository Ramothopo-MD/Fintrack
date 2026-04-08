const express = require("express");
const router = express.Router({ mergeParams: true }); 
const itemController = require("../Controllers/itemsController");

// CREATE item for a receipt (POST /api/receipts/:receiptId/items)
router.post("/", itemController.create);

// READ all items for a receipt (GET /api/receipts/:receiptId/items)
router.get("/", itemController.getByReceipt);

// UPDATE a specific item (PUT /api/receipts/:receiptId/items/:itemId)
router.post("/update-item/:item_id", itemController.updateItems);

// router.put("/update-items", itemController.update);

// DELETE a specific item (DELETE /api/receipts/:receiptId/items/:itemId)
router.delete("/delete-item/:itemId", itemController.delete);

module.exports = router;
