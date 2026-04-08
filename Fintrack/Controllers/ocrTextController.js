const OcrTextModel = require("../Models/ocrTextModel");

const ocrTextController = {
  // CREATE OCR log
  async create(req, res) {
    try {
      const { receiptId, rawText } = req.body;
      const ocrId = await OcrTextModel.saveOcrText(receiptId, rawText);
      const log = await OcrTextModel.getOcrByReceiptId(receiptId);
      res.status(201).json(log);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // READ all OCR logs
  async getAll(req, res) {
    try {
      const logs = await OcrTextModel.getAllOcrLogs();
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // READ OCR by receipt
  async getByReceipt(req, res) {
    try {
      const receiptId = req.params.receiptId;
      const log = await OcrTextModel.getOcrByReceiptId(receiptId);
      if (!log) return res.status(404).json({ error: "OCR text not found" });
      res.json(log);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // UPDATE OCR text
  async update(req, res) {
    try {
      const id = req.params.id;
      const updated = await OcrTextModel.updateOcrText(id, req.body.rawText);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // DELETE OCR text
  async delete(req, res) {
    try {
      const id = req.params.id;
      await OcrTextModel.deleteOcrText(id);
      res.json({ success: true, message: "OCR text deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = ocrTextController;
