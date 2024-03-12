const unsafeMode = true;

const mysql = require('mysql2/promise');
const dbConfig = {
	host: process.env.DB_CONNECTION_HOST,
    port: process.env.DB_CONNECTION_PORT,
	user: process.env.DB_CONNECTION_USER,
	password: process.env.DB_CONNECTION_PASS,
	database: process.env.DB_CONNECTION_NAME,
	multipleStatements: unsafeMode,
	namedPlaceholders: true
};

var database = mysql.createPool(dbConfig);

module.exports = database