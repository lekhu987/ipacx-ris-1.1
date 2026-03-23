// backend/db.js
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, ".env") }); // load backend/.env variables

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
  database: process.env.POSTGRES_DB || "RIS",
});

module.exports = pool;
