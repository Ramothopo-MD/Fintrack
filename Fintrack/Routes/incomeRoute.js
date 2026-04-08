const express = require('express');
const router = express.Router();
const incomeController = require('../Controllers/incomeController');

// Create/Set Income
router.post('/save-income', incomeController.createIncome);

// Update Income
router.put('/update-income', incomeController.updateIncome);

// Delete Income
router.delete('/delete-income', incomeController.deleteIncome);

// API/debug routes (optional)
router.get('/get-income', incomeController.getIncome);
router.get('/all', incomeController.getAllIncomes);

module.exports = router;
