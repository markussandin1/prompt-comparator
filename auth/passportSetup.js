// auth/passportSetup.js
require('dotenv').config(); // Se till att denna rad är högst upp
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;


passport.serializeUser((user, done) => {
  // Här kan du serialisera användaren till sessionen.
  done(null, user);
});

passport.deserializeUser((user, done) => {
  // Här kan du deserialisera användaren från sessionen.
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/redirect',
    },
    (accessToken, refreshToken, profile, done) => {
      // Begränsa åtkomst till @bonniernews.se-domänen
      if (profile._json.hd === 'bonniernews.se') {
        // Användaren har korrekt domän
        done(null, profile);
      } else {
        // Fel domän, neka åtkomst
        done(null, false, { message: 'Unauthorized domain' });
      }
    }
  )
);

 