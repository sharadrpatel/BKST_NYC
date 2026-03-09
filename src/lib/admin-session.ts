import { cookies } from "next/headers";

export const ADMIN_COOKIE = "bkst_admin";

export async function isAdminAuthed(): Promise<boolean> {
  const jar = await cookies();
  const val = jar.get(ADMIN_COOKIE)?.value;
  return !!val && !!process.env.ADMIN_KEY && val === process.env.ADMIN_KEY;
}

/** Throws if the request is not from an authenticated admin. */
export async function assertAdmin(): Promise<void> {
  if (!(await isAdminAuthed())) throw new Error("Unauthorized");
}

export async function setAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, process.env.ADMIN_KEY!, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}
