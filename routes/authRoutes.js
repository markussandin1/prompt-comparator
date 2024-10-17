// routes/authRoutes.js
const router = require('express').Router();
const passport = require('passport');

// Auth login
router.get('/login', (req, res) => {
  res.send('<a href="/auth/google">Logga in med Google</a>');
});

// Auth logout
router.get('/logout', (req, res) => {
  // Hantera logout
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// Auth med Google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback route för Google att omdirigera till
router.get(
  '/google/redirect',
  passport.authenticate('google', { failureRedirect: '/auth/login' }),
  (req, res) => {
    // Användaren är nu autentiserad
    res.redirect('/protected');
  }
);

module.exports = router;