const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const axios = require('axios');
const fs = require('fs');
const Card = require('./models/card');

require('dotenv').config(); // Load environment variables if used (optional)

const app = express();
const PORT = 3001;

// MongoDB Connection
mongoose.connect('mongodb+srv://jae:min@tokkiapi.gut9u.mongodb.net/kpop-cards', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));



// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Setup
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: false, // Set true if using HTTPS
  },
}));

// Passport Configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new DiscordStrategy({
  clientID: '1326882079698456657',
  clientSecret: '9uAntIxBk9iLFFfyaEcnt8sXCH6G8vBW',
  callbackURL: 'http://localhost:3001/auth/discord/callback',
  scope: ['identify', 'guilds', 'guilds.members.read'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    profile.accessToken = accessToken;
    profile.avatarURL = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
    profile.tag = `${profile.username}#${profile.discriminator}`;
    return done(null, profile);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));


// Endpoint to check if card code exists
app.get('/check-card-code/:code', async (req, res) => {
  const { code } = req.params;
  
  try {
    const cardExists = await Card.findOne({ code });
    if (cardExists) {
      return res.json({ exists: true });
    }
    return res.json({ exists: false });
  } catch (error) {
    console.error('Error checking card code:', error); // Make sure this logs
    return res.status(500).json({ error: 'Error checking card code' });
  }
});


app.get('/api/cards', async (req, res) => {
  try {
    const type = req.query.type || 'all';

    let query = {};
    if (type === 'droppable') query = { availability: 'droppable' };
    else if (type === 'archived') query = { availability: 'archived' };

    const cards = await Card.find(query);
    res.json(cards); // Respond with the filtered cards
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Routes
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('login'); // Render login.ejs
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  });

app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('dashboard', { user: req.user });
});

app.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).send('Error during logout.');
    }
    req.session.destroy();
    res.redirect('/');
  });
});

// Card Management Routes
app.get('/add-card', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('index', { user: req.user });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationMap = {
      image: 'public/images/',
      backCover: 'public/backcovers/',
      backCoverEvent: 'public/backcovers/',
    };
    cb(null, destinationMap[file.fieldname] || 'public/images/');
  },
  filename: (req, file, cb) => {
    if (!req.body.code) {
      return cb(new Error('Card code is missing'));
    }
    const extension = path.extname(file.originalname);
    cb(null, `${req.body.code}${extension}`);
  },
});

const upload = multer({ storage });

app.post('/add-card', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'backCover', maxCount: 1 },
  { name: 'backCoverEvent', maxCount: 1 },
]), async (req, res) => {
  try {
    const { name, group, theme, code, eventEmoji } = req.body;
    const cardType = req.body.cardType || 'normal';
    if (!name || !group || !theme || !code || !req.files['image']) {
      return res.status(400).send('All required fields must be filled.');
    }
    const frontImageUrl = `${req.protocol}://${req.get('host')}/images/${req.files['image'][0].filename}`;
    const card = new Card({
      name, group, theme, code, cardType, imagePath: frontImageUrl,
    });
    await card.save();
    
    // Redirect to a success page with a success message
    res.render('success', { user: req.user });
  } catch (error) {
    console.error('Error adding card:', error);
    res.status(500).send('Error adding card.');
  }
});


// Static Routes
app.use('/images', express.static('public/images'));

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// Fetch cards based on type
app.get('/api/cards', async (req, res) => {
  const { type } = req.query;

  try {
    let query = {};
    if (type === 'droppable') {
      query = { droppable: true }; // Adjust this based on your schema
    } else if (type === 'archived') {
      query = { archived: true }; // Adjust this based on your schema
    }

    const cards = await Card.find(query).select('name group theme imagePath'); // Select only required fields
    res.json(cards);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Error fetching cards' });
  }
});


