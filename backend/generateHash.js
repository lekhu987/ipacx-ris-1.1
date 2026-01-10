const bcrypt = require('bcryptjs');

const password = 'admin123'; // replace with your desired password
const hash = bcrypt.hashSync(password, 10); // 10 is the salt rounds

console.log('Hashed password:', hash);
