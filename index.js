require("dotenv").config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');

const db_users = require('./database/users.js')
const db_utils = require('./database/db_utils.js') 
const db_chats = require('./database/chats.js')

const saltRounds = 12;

const port = process.env.PORT || 3000;
const expireTime = 60 * 60 * 1000;

const app = express();

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

db_utils.printMySQLVersion();

var mongoStore = MongoStore.create({
    mongoUrl:`mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`,
    crypto: {
		secret: mongodb_session_secret
	}
});



app.use(session({ 
        secret: node_session_secret,
        store: mongoStore, //default is memory store 
        saveUninitialized: false, 
        resave: true
    }
));

function isValidSession(req) {
	if (req.session.authenticated) {
		return true;
	}
	return false;
}

function checkUserExists(req, res, next) {
    if (app.locals.user === undefined) {
        req.session.destroy();
        res.redirect('/login');
        return;
    } else {
        next();
    }
}

function sessionValidation(req, res, next) {
	if (!isValidSession(req)) {
		req.session.destroy();
		res.redirect('/login');
		return;
	}
	else {
        checkUserExists(req, res, next);
	}
}

function sessionLoggedIn(req, res, next) {
    console.log("Validating session...");
    if (isValidSession(req)) {
        checkUserExists(req, res, next);
        res.redirect("/chats")
        return;
    } else {
        next();
    }
}

app.use('/login', sessionLoggedIn);
app.use('/registration', sessionLoggedIn);

app.use('/chats', sessionValidation);
app.use('/chat', sessionValidation);

app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'ejs');

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.get('/chat', async (req, res) => { 
    let data = await db_chats.getChat({room_id: req.query.id});

    res.render('chat', {messages: data, user_id: app.locals.user.user_id, room_id: req.query.id});
});

app.post('/chat/:id', async (req, res) => {
    let postData = {message: req.body.message, user_id: app.locals.user.user_id, room_id: req.params.id}

    await db_chats.sendMessage(postData);

    res.redirect(`/chat?id=${postData.room_id}`);
});

app.get('/emoji/:id', async (req, res) => {
    let postData = {user_id: app.locals.user.user_id, message_id: req.params.id};

    let message = await db_chats.getMessage(postData);

    res.render('newEmoji', {message: message});
});

app.post('/emoji/:id', async (req, res) => {
    let postData = {user_id: app.locals.user.user_id, message_id: req.params.id};

    let original = await db_chats.getMessage(postData);

    let checked = req.body;

    let new_checked = {};

    for (let i = 0; i < original.emojis.length; i++) {
        let emoji = original.emojis[i];
        if (checked[emoji.id] === undefined) {
            new_checked[emoji.id] = "off";
        } else {
            new_checked[emoji.id] = "on";
        }
    }

    for (let i = 0; i < original.emojis.length; i++) {
        let emoji = original.emojis[i];
        console.log(new_checked[emoji.id] + " " + emoji.checked);
        if ((new_checked[emoji.id] === "on") ^ emoji.checked) {
            await db_chats.toggleReaction(app.locals.user.user_id, postData.message_id, emoji.id);
        }
    }

    res.redirect(`/chat?id=${original.r_id}`);
});

app.get('/chats', async (req, res) => {
    let data = await db_chats.getAllChats({user_id: app.locals.user.user_id});

    res.render('chats', {chats: data});
});

app.get('/login', (req, res) => {
    res.render('login', {error: false});
});

app.post('/login', async (req, res) => {
    let postData = req.body;
    let user = await db_users.getUser(postData);
    if (user) {
        if (postData.password === user.password_hash) {//bcrypt.compare(postData.password, user.password_hash)) {
            console.log("User authenticated");
            app.locals.user = user;

            req.session.authenticated = true;
            req.session.username = user.username;
            req.session.cookie.maxAge = expireTime;

            res.redirect('/chats');
            return;
        }
    }
    res.redirect('/login');
});