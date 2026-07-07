export type UserLike = { id: string; role?: string | null };

export function isModeratorOrAdmin(user?: UserLike): boolean {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  return role === "moderator" || role === "admin";
}