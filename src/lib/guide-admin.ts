import type { User } from "@supabase/supabase-js";

export const GUIDE_ADMIN_USER_ID = "c6f4fe0c-16ee-489e-9734-da2492f9a502";
export const GUIDE_ADMIN_EMAIL = "imblueop@gmail.com";

export function isGuideAdmin(user?: Pick<User, "id" | "email"> | null) {
  if (!user) return false;
  return user.id === GUIDE_ADMIN_USER_ID || user.email?.toLowerCase() === GUIDE_ADMIN_EMAIL;
}
