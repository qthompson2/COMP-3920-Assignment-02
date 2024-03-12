require("dotenv").config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');

const db_users = require('./database/users.js')
const db_utils = require('./database/db_utils.js') 

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

function sessionValidation(req, res, next) {
	if (!isValidSession(req)) {
		req.session.destroy();
		res.redirect('/login');
        app.locals.username = ""
		return;
	}
	else {
		next();
	}
}

function sessionLoggedIn(req, res, next) {
    if (isValidSession(req)) {
        res.redirect("/members")
        return;
    } else {
        next();
    }
}

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

let exampleChat = [
    {
        time: '2021-02-01T12:00:00',
        username: 'user1',
        content: 'Hello',
        emojis: [
            {
                icon: '😁',
                count: 1
            },
            {
                icon: '🥰',
                count: 2
            }
        ]
    },
    {
        time: '2021-02-01T12:01:00',
        username: 'user2',
        content: 'That\'s nice.',
        emojis: []
    },
    {
        time: '2021-02-01T12:02:00',
        username: 'user1',
        content: 'I know, right?',
        emojis: [
            {
                icon: '😁',
                count: 1
            }
        ]
    },
    {
        time: '2021-02-01T12:03:00',
        username: 'user2',
        content: 'I\'m glad you\'re happy.',
        emojis: [
            {
                icon: '😁',
                count: 1
            }
        ]
    }
]

let exampleUsers = [
    {
        username: 'user1',
        status: 'online'
    },
    {
        username: 'user2',
        status: 'offline'
    },
    {
        username: 'user3',
        status: 'online'
    },
    {
        username: 'user4',
        status: 'offline'
    }
]

let exampleEmojis = [
    {
        name: 'smiling face',
        icon: '😁',
    },
    {
        name: 'hearts',
        icon: '🥰',
    },
    {
        name: 'thumbs up',
        icon: '👍',
    },
    {
        name: 'thumbs down',
        icon: '👎',
    },
    {
        name: 'laughing',
        icon: '😂',
    }
]

app.get('/chatExample', (req, res) => {
  res.render('chat', {messages: exampleChat});
});

app.get('/chatsExample', (req, res) => {
    res.render('chats', {messages: exampleChat});
});

// This could be combined with the chats page
app.get('/newGroupExample', (req, res) => {
    res.render('newGroup', {people: exampleUsers});
});

// This could be done with a dropdown menu instead of it's own page
app.get('/addEmojisExample', (req, res) => {
    res.render('newEmoji', {emojis: exampleEmojis, message: exampleChat[0]});
});