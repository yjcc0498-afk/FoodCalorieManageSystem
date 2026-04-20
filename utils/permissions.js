const getUserRole = (user) => {
  return String(user && user.role ? user.role : 'user').trim().toLowerCase();
};

const isAdminUser = (user) => {
  return getUserRole(user) === 'admin';
};

module.exports = {
  getUserRole,
  isAdminUser
};
