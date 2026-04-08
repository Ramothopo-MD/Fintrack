const express = require("express");
const multer = require("multer");
const receiptController = require("../Controllers/receiptControllers");
const itemController = require("../Controllers/itemsController");
const ocrTextController = require("../Controllers/ocrTextController");
const {isAdmin,isAuthenticated}= require("../Middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Receipts
router.post("/parse-receipt", upload.single("image"), receiptController.parseReceipt);
router.post("/receipts",isAuthenticated, receiptController.create);
router.get("/receipts",isAuthenticated, receiptController.getAll);
router.get("/receipts/:id",isAuthenticated, receiptController.getById);
router.put("/receipts/:id", isAuthenticated,receiptController.update);
router.delete("/receipts/:id",isAuthenticated, receiptController.delete);

// Items
router.post("/items",isAuthenticated, itemController.create);
router.get("/items/receipt/:receiptId", isAuthenticated,itemController.getByReceipt);
router.put("/items/:id",isAuthenticated, itemController.update);
router.delete("/items/:id",isAuthenticated, itemController.delete);

// OCR Texts
router.post("/ocr",isAuthenticated, ocrTextController.create);
router.get("/ocr",isAuthenticated, ocrTextController.getAll);
router.get("/ocr/receipt/:receiptId",isAuthenticated, ocrTextController.getByReceipt);
router.put("/ocr/:id",isAuthenticated, ocrTextController.update);
router.delete("/ocr/:id",isAuthenticated, ocrTextController.delete);

module.exports = router;
