const ComplaintModel = require('../Models/complaintsModel');
const UserModel = require('../Models/userModel');
const pool = require('../Config/db');

const complaintController = {
  /* ============================================================
   * 👤 USER SIDE
   * ============================================================ */

  // ✅ Render complaint form page
  async getComplaintForm(req, res) {
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/user/login');

      res.render('User/complaint-form', {
        title: 'Submit Complaint - FinTrack',
        user
      });
    } catch (err) {
      console.error('❌ Error loading complaint form:', err);
      res.status(500).render('error', { message: 'Unable to load complaint form.' });
    }
  },

  // ✅ Handle complaint submission
  // ✅ Handle complaint submission
async submitComplaint(req, res) {
  try {
    const user = req.session.user;
    if (!user) return res.redirect('/user/login');

    const { subject, message, priority } = req.body;
    if (!subject || !message) {
      req.session.feedback = { type: 'danger', text: 'Subject and message are required.' };
      return res.redirect('/user/dashboard');
    }

    const complaintId = await ComplaintModel.createComplaint({
      user_id: user.user_id,
      subject,
      message,
      priority: priority || 'medium'
    });

    console.log(`✅ Complaint submitted (ID: ${complaintId}) by user ${user.email}`);

    // ✅ store temporary success message for dashboard
    req.session.feedback = {
      type: 'success',
      text: 'Your complaint was submitted successfully. We’ll get back to you soon!'
    };

    return res.redirect('/user/dashboard');
  } catch (err) {
    console.error('❌ Error submitting complaint:', err);
    req.session.feedback = { type: 'danger', text: 'Failed to submit complaint. Please try again.' };
    return res.redirect('/user/dashboard');
  }
}
,

  // ✅ View user’s own complaints
  async getUserComplaints(req, res) {
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/user/login');

      const [complaints] = await req.app.get('db').query(
        `SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC`,
        [user.user_id]
      );

      res.render('User/my-complaints', {
        title: 'My Complaints - FinTrack',
        complaints,
        user
      });
    } catch (err) {
      console.error('❌ Error fetching user complaints:', err);
      res.status(500).render('error', { message: 'Could not fetch your complaints.' });
    }
  },

  /* ============================================================
   * 👑 ADMIN SIDE
   * ============================================================ */

  // ✅ Display all complaints
  async getAllComplaints(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).render('error', { message: 'Access denied.' });
      }

      const complaints = await ComplaintModel.getAll(100);
      const openCount = await ComplaintModel.countOpen();

      res.render('Admin/manage-complaints', {
        title: 'All Complaints - FinTrack Admin',
        complaints,
        openCount,
        user
      });
    } catch (err) {
      console.error('❌ Error loading complaints:', err);
      res.status(500).render('error', { message: 'Unable to load complaints.' });
    }
  },

  // ✅ View a specific complaint
  async viewComplaint(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).render('error', { message: 'Access denied.' });
      }

      const { id } = req.params;
      const complaint = await ComplaintModel.getById(id);
      

      if (!complaint) {
        return res.status(404).render('error', { message: 'Complaint not found.' });
      }

      res.render('Admin/complaint-detail', {
        title: `Complaint #${id}`,
        complaint,
        user
      });
    } catch (err) {
      console.error('❌ Error fetching complaint:', err);
      res.status(500).render('error', { message: 'Unable to fetch complaint.' });
    }
  },

  // ✅ Update status or priority (admin)
  async updateComplaint(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const { id } = req.params;
      const { status, priority } = req.body;

      const updated = await ComplaintModel.updateComplaint(id, { status, priority });
      if (updated) {
        console.log(`📝 Complaint #${id} updated → ${status.toUpperCase()} (${priority})`);
        return res.json({ success: true, message: 'Complaint updated successfully.' });
      }

      res.status(400).json({ success: false, message: 'Failed to update complaint.' });
    } catch (err) {
      console.error('❌ Error updating complaint:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  // ✅ Delete complaint
  async deleteComplaint(req, res) {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const { id } = req.params;
      const deleted = await ComplaintModel.deleteComplaint(id);

      if (deleted) {
        console.log(`🗑️ Complaint #${id} deleted`);
        return res.json({ success: true, message: 'Complaint deleted successfully.' });
      }

      res.status(404).json({ success: false, message: 'Complaint not found.' });
    } catch (err) {
      console.error('❌ Error deleting complaint:', err);
      res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
    }
  }
};

module.exports = complaintController;
