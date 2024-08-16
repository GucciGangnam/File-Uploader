var express = require('express');
var router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();



/* GET home page. */
router.get('/', async function (req, res, next) {
  if (req.isAuthenticated()) {
    console.log(req.user, req.user.id)
    // Get all that users folders 
    const folders = await prisma.folder.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc' // Sort by createdAt in descending order
      },
    })
    // User is authenticated, so `req.user` contains user info
    res.render('home', { user: req.user, folders: folders });
  } else {
    // User is not authenticated, redirect to login
    res.redirect('/login');
  }
});

// -----------------------------------------------------------------------------

// LOGIN PAGE 
// GET
router.get('/login', function (req, res, next) {
  const username = req.query.username || '';
  const messages = {
    error: req.flash('error') // Ensure this is properly set
  };
  res.render('login', { username, messages });
});
// POST
router.post('/login', function (req, res, next) {
  passport.authenticate('local', function (err, user, info) {
    if (err) { return next(err); }
    if (!user) {
      req.flash('error', info.message || 'Login failed');
      return res.redirect('/login');
    }
    req.logIn(user, function (err) {
      if (err) { return next(err); }
      return res.redirect('/');
    });
  })(req, res, next);
});

// LOGOUT
router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});


// -----------------------------------------------------------------------------


// SIGN UP PAGE
// GET
router.get('/signup', function (req, res, next) {
  res.render('signup')
})
// POST
router.post('/signup', async function (req, res, next) {
  const userName = req.body.userName;
  const password = req.body.password;
  const email = req.body.email;

  try {
    // Sanitize user inputs
    userName.trim();
    email.trim();
    // Check if userName already exists in DB 
    const existingUsername = await prisma.user.findFirst({
      where: {
        name: userName,
      },
    })
    if (existingUsername) {
      throw new Error('Username already in use');
    }
    // Check if email already exsist in DB 
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: email
      }
    })
    if (existingEmail) {
      throw new Error('Email already in use')
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)
    // Create the user
    await prisma.user.create({
      data: {
        name: userName,
        password: hashedPassword,
        email: email
      }
    });
    // Redirect client to login page
    res.redirect(`/login?username=${encodeURIComponent(userName)}`);

  } catch (error) {
    console.error(error.message);
    res.render('signup', { error: error })
  }
})

// -----------------------------------------------------------------------------



module.exports = router;
