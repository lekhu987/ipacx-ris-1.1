const bcrypt = require("bcryptjs");

const password = process.env.HASH_PASSWORD || "";
if (!password) {
  console.error("Set HASH_PASSWORD to generate a bcrypt hash.");
  process.exit(1);
}

const saltRounds = Number(process.env.HASH_SALT_ROUNDS || 10);
const hash = bcrypt.hashSync(password, saltRounds);

console.log("Hashed password:", hash);
