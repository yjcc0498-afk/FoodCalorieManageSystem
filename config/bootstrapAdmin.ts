import User from '../models/User';

type AdminConfig = {
  username: string;
  email: string;
  password: string;
};

const readAdminConfig = (): AdminConfig => {
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

const hasAdminConfig = ({ username, email, password }: AdminConfig) => {
  return Boolean(username && email && password);
};

const logBootstrapConflict = (reason: string) => {
  console.warn(`Admin bootstrap skipped. ${reason}`);
};

const ensureAdminUser = async () => {
  const adminConfig = readAdminConfig();

  if (!hasAdminConfig(adminConfig)) {
    console.warn('Admin bootstrap skipped. Check ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD in .env.');
    return null;
  }

  const conflictingUsers = await User.find({
    $or: [
      { username: adminConfig.username },
      { email: adminConfig.email }
    ]
  }).select('+password');

  if (conflictingUsers.length > 1) {
    logBootstrapConflict('Multiple users conflict with ADMIN_USERNAME or ADMIN_EMAIL in .env.');
    return null;
  }

  const existingUser = conflictingUsers[0];

  if (existingUser) {
    if (existingUser.role !== 'admin') {
      logBootstrapConflict('A regular user already uses ADMIN_USERNAME or ADMIN_EMAIL in .env.');
      return null;
    }

    let shouldSave = false;

    if (existingUser.username !== adminConfig.username) {
      existingUser.username = adminConfig.username;
      shouldSave = true;
    }

    if (existingUser.email !== adminConfig.email) {
      existingUser.email = adminConfig.email;
      shouldSave = true;
    }

    const passwordMatches = await existingUser.comparePassword(adminConfig.password);
    if (!passwordMatches) {
      existingUser.password = adminConfig.password;
      shouldSave = true;
    }

    if (shouldSave) {
      await existingUser.save();
    }

    return existingUser;
  }

  return User.create({
    username: adminConfig.username,
    email: adminConfig.email,
    password: adminConfig.password,
    role: 'admin'
  });
};

export {
  ensureAdminUser,
  readAdminConfig
};
