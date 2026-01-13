const { Pool } = require("pg");

console.log("DB PASSWORD TYPE:", typeof process.env.POSTGRES_PASSWORD);

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER,
  password: String(process.env.POSTGRES_PASSWORD), // FORCE STRING
  database: process.env.POSTGRES_DB,
});

module.exports = pool;
