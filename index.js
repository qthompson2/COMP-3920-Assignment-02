require("dotenv").config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');

const db_users = require('./database/users.js')
const db_utils = require('./database/db_utils.js') 
const db_chats = require('./database/chats.js');

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
    if (isValidSession(req) && app.locals.user !== undefined) {
        res.redirect("/chats")
        return;
    } else {
        next();
    }
}

app.use('/login', sessionLoggedIn);
app.use('/register', sessionLoggedIn);

app.use('/chats', sessionValidation);
app.use('/chat', sessionValidation);
app.use('/add-user', sessionValidation);
app.use('/new-chat', sessionValidation);
app.use('/emoji', sessionValidation);

app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'ejs');

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/chat', async (req, res) => { 
    let user_chats = await db_chats.getAllChats({user_id: app.locals.user.user_id});
    let valid_id = false;

    for (let i = 0; i < user_chats.length; i++) {
        let id = user_chats[i].id;
        
        if (id == req.query.id) {
            valid_id = true;
            break;
        }
    }

    if (valid_id) {
        let data = await db_chats.getChat({room_id: req.query.id});

        await db_chats.updateLastRead({user_id: app.locals.user.user_id, room_id: req.query.id});

        res.render('chat', {messages: data, user_id: app.locals.user.user_id, room_id: req.query.id});
    } else {
        res.redirect('/400');
    }
});

app.post('/chat/:id', async (req, res) => {
    let postData = {message: req.body.message, user_id: app.locals.user.user_id, room_id: req.params.id}

    await db_chats.sendMessage(postData);

    await db_chats.updateLastRead({user_id: app.locals.user.user_id, room_id: req.params.id});

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

    res.render('chats', {chats: data, username: app.locals.user.username});
});

app.get('/add-user', async (req, res) => {
    let users = await db_chats.getChatUsers({room_id: req.query.id});

    res.render('addUser', {room_id: req.query.id, user_not_found: req.query.user_not_found, users: users});
});

app.post('/add-user/:id', async (req, res) => {
    let room_id = req.params.id;

    let user = await db_users.getUserByName({username: req.body.username});

    if (user) {
        await db_chats.addUserToChat({user_id: user.id, room_id: room_id});
        res.redirect('/chats');
    } else {
        console.log("User not found");
        res.redirect(`/add-user?id=${room_id}&user_not_found=true`);
    }
});

app.get('/new-chat', async (req, res) => {
    let data = await db_users.getUsers();

    res.render('newGroup', {users: data, user_id: app.locals.user.user_id});
});

app.post('/new-chat', async (req, res) => {
    let postData = req.body;

    let keys = Object.keys(postData);
    let user_ids = [];
    
    for (let i = 0; i < keys.length; i++) { 
        if (keys[i] !== "groupName") {
            user_ids.push(parseInt(keys[i]));
        }
    }

    user_ids.push(app.locals.user.user_id);

    await db_chats.createRoom(postData.groupName, user_ids);

    res.redirect('/chats');
});

app.get('/login', (req, res) => {
    let error;
    
    if (req.query.error === undefined) {
        error = false;
    } else {
        error = true;
    }

    res.render('login', {error: error});
});

app.post('/login', async (req, res) => {
    let postData = req.body;
    let user = await db_users.getUser(postData);

    if (user) {
        if (bcrypt.compareSync(postData.password, user.password_hash)) { //postData.password === user.password_hash) {
            console.log("User authenticated");
            app.locals.user = user;

            req.session.authenticated = true;
            req.session.username = user.username;
            req.session.cookie.maxAge = expireTime;

            res.redirect('/chats');
            return;
        }
    }
    res.redirect('/login?error=true');
    return;
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/register', (req, res) => {
    let error;
    let passwordError;
    
    if (req.query.error === undefined) {
        error = false;
    } else {
        error = true;
    }

    if (req.query['password-error'] === undefined) {
        passwordError = false;
    } else {
        passwordError = true;
    }

    res.render('register', {error: error, passwordError: passwordError, passwordErrors: [req.query['too-short'], req.query['wrong-case'], req.query['no-number'], req.query['no-special']]});
});

app.post('/register', async (req, res) => {
    let postData = req.body;
    let errors = {
        tooShort: false,
        wrongCase: false,
        noNumber: false,
        noSpecial: false
    }

    //Check Password Requirements
    let password = postData.password;
    if (password.length < 9) {
        errors.tooShort = true;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z]).+$/.test(password)) {
        errors.wrongCase = true;
    }
    if (!/\d/.test(password)) {
        errors.noNumber = true;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) { 
        errors.noSpecial = true;
    }

    if (errors.tooShort || errors.wrongCase || errors.noNumber || errors.noSpecial) {
        res.redirect(`/register?password-error=true&too-short=${errors.tooShort}&wrong-case=${errors.wrongCase}&no-number=${errors.noNumber}&no-special=${errors.noSpecial}`);
        return;
    }

    if (postData.username === "" || postData.email === "") { 
        res.redirect('/register?error=true');
        return;
    }

    let hashedPassword = await bcrypt.hash(postData.password, saltRounds);

    let user = await db_users.createUser({email: postData.email, username: postData.username, hashedPassword: hashedPassword});

    if (!user) {
        res.redirect('/register?error=true');
        return;
    }

    res.redirect('/login');
});

app.get('/400', async (req, res) => {
    res.render('400');
});

app.get('*', async (req, res) => {
    res.redirect('/404');
});