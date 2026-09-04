export const ADMIN_ROLES = ["admin", "co_admin"];
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
export const roleLabel = (role) => {
  if (role === "admin") return "Admin";
  if (role === "co_admin") return "Co-Admin";
  return "Member";
};
