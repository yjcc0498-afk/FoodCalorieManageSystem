const User = require('../models/User');

const readAdminConfig = () => {
  return {
    username:
      typeof process.env.ADMIN_USERNAME === 'string'
        ? process.env.ADMIN_USERNAME.trim().toLowerCase()
        : '',
    email:
      typeof process.env.ADMIN_EMAIL === 'string'
        ? process.env.ADMIN_EMAIL.trim().toLowerCase()
        : '',
    password: typeof process.env.ADMIN_PASSWORD === 'string' ? process.env.ADMIN_PASSWORD : ''
  };
};

const hasAdminConfig = ({ username, email, password }) => {
  return Boolean(username && email && password);
};

const ensureAdminUser = async () => {
  const adminConfig = readAdminConfig();

  if (!hasAdminConfig(adminConfig)) {
    console.warn('Admin bootstrap skipped. Check ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD in .env.');
    return null;
  }

  const existingUser = await User.findOne({
    $or: [
      { username: adminConfig.username },
      { email: adminConfig.email }
    ]
  }).select('+password');

  if (existingUser) {
    existingUser.username = adminConfig.username;
    existingUser.email = adminConfig.email;
    existingUser.password = adminConfig.password;
    existingUser.role = 'admin';

    await existingUser.save();
    return existingUser;
  }

  const adminUser = await User.create({
    username: adminConfig.username,
    email: adminConfig.email,
    password: adminConfig.password,
    role: 'admin'
  });

  return adminUser;
};

module.exports = {
  ensureAdminUser,
  readAdminConfig
};
