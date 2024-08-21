var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
const { PrismaClient } = require('@prisma/client');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var folderRouter = require('./routes/folders')

var app = express();
const prisma = new PrismaClient();

// Configure session middleware
app.use(session({
  cookie: { maxAge: 20 * 60 * 1000 }, // 5 minutes
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000, // 2 minutes
    dbRecordIdIsSessionId: true,
  }),
}));

app.use(flash());

// Configure Passport to use local strategy
passport.use(new LocalStrategy(
  async function (username, password, done) {
    try {
      const user = await prisma.user.findFirst({
        where: { name: username }
      });
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Serialize user
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async function (id, done) {
  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

app.use(passport.initialize());
app.use(passport.session());


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/folders', folderRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
