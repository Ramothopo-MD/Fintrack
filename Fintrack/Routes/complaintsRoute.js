const express = require('express');
const router = express.Router();
const complaintController = require('../Controllers/complaintsController');
const { isAuthenticated, isAdmin } = require('../Middleware/auth');

/* ============================================================
 * 👤 USER ROUTES
 * ============================================================ */

// 📝 Show complaint form
router.get('/submit', isAuthenticated, complaintController.getComplaintForm);

// 📩 Handle complaint submission
router.post('/submit', isAuthenticated, complaintController.submitComplaint);

// 📋 View user’s own complaints
router.get('/my', isAuthenticated, complaintController.getUserComplaints);


/* ============================================================
 * 👑 ADMIN ROUTES
 * ============================================================ */

// 📋 View all complaints
router.get('/admin', isAuthenticated, isAdmin, complaintController.getAllComplaints);

// 🔍 View single complaint
router.get('/admin/view/:id', isAuthenticated, isAdmin, complaintController.viewComplaint);

// ✏️ Update complaint (status or priority)
router.post('/admin/update/:id', isAuthenticated, isAdmin, complaintController.updateComplaint);

// 🗑️ Delete complaint
router.post('/admin/delete/:id', isAuthenticated, isAdmin, complaintController.deleteComplaint);


/* ============================================================
 * EXPORT
 * ============================================================ */
module.exports = router;
