//导入User模型
//后面所有操作都是直接操作数据库里的用户表

const User = require('../models/User');

//定义一个函数：从 .env 读取管理员配置
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

//第二部分：检查配置是否完整
const hasAdminConfig = ({ username, email, password }) => {
  return Boolean(username && email && password);
};

//为环境变量中的管理员账户服务
const ensureAdminUser = async () => {
  const adminConfig = readAdminConfig();

  if (!hasAdminConfig(adminConfig)) {
    console.warn('Admin bootstrap skipped. Check ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD in .env.');
    return null;
  }

  //查数据库有没有这个用户
  const existingUser = await User.findOne({
    $or: [
      { username: adminConfig.username },
      { email: adminConfig.email }
    ]
  }).select('+password');

  //有就更新新管理员账号
  if (existingUser) {
    existingUser.username = adminConfig.username;
    existingUser.email = adminConfig.email;
    existingUser.password = adminConfig.password;
    existingUser.role = 'admin';

    //自动加密密码
    await existingUser.save();
    //更新管理员账号
    return existingUser;
  }

  //管理员不存在就创建
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
