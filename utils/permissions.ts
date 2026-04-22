type RoleCarrier = {
  role?: unknown;
};

const getUserRole = (user?: RoleCarrier | null): string => {
  return String(user && user.role ? user.role : 'user').trim().toLowerCase();
};

const isAdminUser = (user?: RoleCarrier | null): boolean => {
  return getUserRole(user) === 'admin';
};

export = {
  getUserRole,
  isAdminUser
};
