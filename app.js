// app.js
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const authRoutes = require('./routes/authRoutes');
const passportSetup = require('./auth/passportSetup');
const promptRoutes = require('./routes/promptRoutes');
const path = require('path');
const app = express();

// Ställ in vy-motor
app.set('view engine', 'ejs');

// Middleware för att servera statiska filer
app.use(express.static(path.join(__dirname, 'public')));

// Sätt upp sessionshantering med express-session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Sätt till true om du använder HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 1 dag
    },
  })
);

// Initiera passport
app.use(passport.initialize());
app.use(passport.session());

// Ställ in body-parser middleware för att kunna läsa req.body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sätt upp rutter
app.use('/auth', authRoutes);
app.use('/', promptRoutes);

// Middleware för att kontrollera autentisering
const authCheck = (req, res, next) => {
  if (!req.user) {
    // Inte inloggad
    res.redirect('/auth/login');
  } else {
    // Inloggad
    next();
  }
};

// Skyddad route
app.get('/protected', authCheck, (req, res) => {
  res.send(`Hej ${req.user.displayName}, du är inloggad och har åtkomst.`);
});

// Hemroute
app.get('/', (req, res) => {
  res.send('Välkommen till Prompt Comparator!');
});

// Använd PORT från miljövariabler, standard till 8080 om inte satt
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Applikationen körs på port ${PORT}`);
});
