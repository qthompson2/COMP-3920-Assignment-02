const database = require('../databaseConnection');

async function createUser(postData) {
	let createUserSQL = `
		INSERT INTO user
		(email, username, password_hash)
		VALUES
		(:email, :username, :passwordHash);
	`;

	let params = {
		email: postData.email,
		username: postData.username,
		passwordHash: postData.hashedPassword
	}

	try {
		const results = await database.query(createUserSQL, params);

        console.log("Successfully created user");
		console.log(results[0]);
		return true;
	}
	catch(err) {
		console.log("Error inserting user");
        console.log(err);
		return false;
	}
}

async function getUsers(postData) {
	let getUsersSQL = `
		SELECT user_id "id", username
		FROM user;
	`;

	try {
		const results = await database.query(getUsersSQL);

        console.log("Successfully retrieved users");
		console.log(results[0]);
		return results[0];
	}
	catch(err) {
		console.log("Error getting users");
        console.log(err);
		return false;
	}
}

async function getUser(postData) {
	let getUserSQL = `
		SELECT user_id, email, username, password_hash
		FROM user
		WHERE email = :email;
	`;

	let params = {
		email: postData.email
	}

	try {
		const results = await database.query(getUserSQL, params);

        console.log("Successfully found user");
		console.log(results[0]);
		return results[0][0];
	}
	catch(err) {
		console.log("Error trying to find user");
        console.log(err);
		return false;
	}
}

async function getUserByName(postData) {
	let getUserSQL = `
		SELECT user_id "id"
		FROM user
		WHERE username = :username;
	`;

	let params = {
		username: postData.username
	}

	try {
		const results = await database.query(getUserSQL, params);

		console.log("Successfully found user");
		console.log(results[0]);
		return results[0][0];
	}
	catch(err) {
		console.log("Error trying to find user");
		console.log(err);
		return false;
	}
}

module.exports = {createUser, getUsers, getUser, getUserByName};