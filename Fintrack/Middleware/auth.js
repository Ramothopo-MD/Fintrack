// ✅ Check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next(); // proceed
  }
  return res.redirect("/user/login"); // redirect if not logged in
}

// ✅ Check if user is an Admin
function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "ADMIN") {
    return next();
  }
  return res.status(403).send("Access denied: Admins only");
}

// ✅ Check if user is a Manager
function isManager(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "MANAGER") {
    return next();
  }
  return res.status(403).send("Access denied: Managers only");
}

// ✅ Check if user is Admin or Manager
function isAdminOrManager(req, res, next) {
  if (
    req.session &&
    req.session.user &&
    (req.session.user.role === "ADMIN" || req.session.user.role === "MANAGER")
  ) {
    return next();
  }
  return res.status(403).send("Access denied: Admins or Managers only");
}

module.exports = { isAuthenticated, isAdmin, isManager, isAdminOrManager };
