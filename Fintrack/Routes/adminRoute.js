const express = require('express');
const router = express.Router();
const AdminController = require('../Controllers/adminController');
const complaintsController = require('../Controllers/complaintsController');
const { isAuthenticated, isAdmin } = require('../Middleware/auth');

/* ============================================================
   👑 ADMIN ROUTES
   ============================================================ */

// 🏠 Dashboard
router.get('/dashboard', isAuthenticated, isAdmin, AdminController.getAdminDashboard);
// 📢 Announcements Management
// ✉️ Add this route for sending bulk emails
router.post('/send-email', isAuthenticated, isAdmin, AdminController.sendEmailToUsers);
// 👥 Users CRUD
router.get('/manage-users', isAuthenticated, isAdmin, AdminController.getAllUsers);
router.post('/users/create', isAuthenticated, isAdmin, AdminController.createUser);
router.post('/users/update/:id', isAuthenticated, isAdmin, AdminController.updateUserByAdmin);
router.get('/users/delete/:id', isAuthenticated, isAdmin, AdminController.deleteUser);

// 💬 Complaints
router.get('/manage-complaints', isAuthenticated, isAdmin, complaintsController.getAllComplaints);
router.get('/complaints/view/:id', isAuthenticated, isAdmin, complaintsController.viewComplaint);
router.post('/complaints/update/:id', isAuthenticated, isAdmin, complaintsController.updateComplaint);
router.get('/complaints/delete/:id', isAuthenticated, isAdmin, complaintsController.deleteComplaint);

// 🚪 Logout
router.post('/logout', isAuthenticated, isAdmin, AdminController.logout);
module.exports = router;