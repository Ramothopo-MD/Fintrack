const AnnouncementModel = require('../Models/announcementModel');
const UserModel = require('../Models/userModel');

const announcementController = {
  /* ============================================================
   * 👑 ADMIN SIDE
   * ============================================================ */

  // ✅ Render announcements management page (Admin Dashboard)
  async manageAnnouncements(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).render('error', { message: 'Access denied.' });
      }

      const announcements = await AnnouncementModel.getAll();
      console.log(`📢 Admin ${user.email} accessed announcements management.`);
      console.log("Getting user details for announcements management page.");
      const users=await UserModel.getAllUsers(user.user_id);


      res.render('Admin/manage-announcements', {
        title: 'Manage Announcements',
        announcements,
        users,
        user,
      });
    } catch (err) {
      console.error('❌ Error loading announcements:', err);
      res.status(500).render('error', { message: 'Unable to load announcements.' });
    }
  },

  // 🔹 Toggle announcement status (NEW)
  async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const newStatus = await AnnouncementModel.toggleStatus(id);

      if (!newStatus) {
        req.flash("error", "Failed to toggle announcement status.");
      } else {
        req.flash("success", `Announcement is now ${newStatus}.`);
      }

      res.redirect("/admin/announcements");
    } catch (err) {
      console.error("❌ Error toggling announcement status:", err);
      req.flash("error", "An error occurred while updating status.");
      res.redirect("/admin/announcements");
    }
  },

  // ✅ Create new announcement
  async createAnnouncement(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      const { title, message, category, status } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required.',
        });
      }

      const announcementId = await AnnouncementModel.create({
        admin_id: user.user_id,
        title,
        message,
        category: category || 'General',
        status: status || 'active',
      });

      console.log(`📢 Announcement created (#${announcementId}) by admin ${user.email}`);

      return res.json({
        success: true,
        message: 'Announcement created successfully.',
        announcementId,
      });
    } catch (err) {
      console.error('❌ Error creating announcement:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to create announcement.',
      });
    }
  },

  // ✅ Get single announcement (for Edit Modal)
  async getAnnouncementById(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      const { id } = req.params;
      const announcement = await AnnouncementModel.getById(id);

      if (!announcement) {
        return res.status(404).json({ success: false, message: 'Announcement not found.' });
      }

      res.json({ success: true, announcement });
    } catch (err) {
      console.error('❌ Error fetching announcement by ID:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch announcement.' });
    }
  },

  // ✅ Update announcement
  async updateAnnouncement(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      const { id } = req.params;
      const { title, message, category, status } = req.body;

      const updated = await AnnouncementModel.update(id, { title, message, category, status });

      if (updated) {
        console.log(`📝 Announcement #${id} updated by admin ${user.email}`);
        return res.json({
          success: true,
          message: 'Announcement updated successfully.',
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
      });
    } catch (err) {
      console.error('❌ Error updating announcement:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update announcement.',
      });
    }
  },

  // ✅ Toggle announcement status (Active/Inactive)
  async toggleAnnouncementStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const announcement = await AnnouncementModel.getById(id);
      if (!announcement)
        return res.status(404).json({ success: false, message: 'Announcement not found.' });

      await AnnouncementModel.update(id, {
        title: announcement.title,
        message: announcement.message,
        category: announcement.category,
        status,
      });

      return res.json({
        success: true,
        message: `Announcement ${status === 'active' ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (err) {
      console.error('❌ Error toggling announcement status:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update announcement status.',
      });
    }
  },

  // ✅ Delete announcement
  async deleteAnnouncement(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      const { id } = req.params;
      const deleted = await AnnouncementModel.delete(id);

      if (deleted) {
        console.log(`🗑️ Announcement #${id} deleted by admin ${user.email}`);
        return res.json({
          success: true,
          message: 'Announcement deleted successfully.',
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
      });
    } catch (err) {
      console.error('❌ Error deleting announcement:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete announcement.',
      });
    }
  },

  /* ============================================================
   * 👤 USER SIDE
   * ============================================================ */

  // ✅ Fetch announcements (API for frontend JS)
  async getAnnouncements(req, res) {
    try {
      const announcements = await AnnouncementModel.getForUser();
      return res.json({
        success: true,
        announcements,
      });
    } catch (err) {
      console.error('❌ Error fetching announcements:', err);
      return res.status(500).json({
        success: false,
        message: 'Unable to fetch announcements.',
      });
    }
  },

  // ✅ Render announcements page (User Dashboard)
  async viewAnnouncements(req, res) {
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/user/login');

      const announcements = await AnnouncementModel.getForUser();

      res.render('User/announcements', {
        title: 'Announcements',
        announcements,
        user,
      });
    } catch (err) {
      console.error('❌ Error loading announcements:', err);
      res.status(500).render('error', { message: 'Unable to load announcements.' });
    }
  },
};

module.exports = announcementController;
