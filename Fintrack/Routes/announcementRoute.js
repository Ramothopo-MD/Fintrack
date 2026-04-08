const express = require('express');
const router = express.Router();
const announcementController = require('../Controllers/announcementController');

// 👑 Admin routes
router.get('/manage-announcements', announcementController.manageAnnouncements);
router.post('/admin/create', announcementController.createAnnouncement);
router.put('/admin/:id', announcementController.updateAnnouncement);
router.delete('/admin/:id', announcementController.deleteAnnouncement);

router.post('/admin/toggle-status/:id', announcementController.toggleStatus);

// 👤 User routes
router.get('/view/announcements', announcementController.viewAnnouncements);
router.get('/view/all', announcementController.getAnnouncements);

module.exports = router;