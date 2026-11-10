import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "./db";
import { UserError } from "./marketplace";
import { hashPassword, hashToken, newToken, verifyPassword } from "./passwords";

const COOKIE = "allocate_session";
const SESSION_DAYS = 30;

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}

export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db.query<User>(
    "select u.id, u.email, u.full_name, u.is_admin from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()",
    [hashToken(token)],
  );
  return row ?? null;
});

export async function requireUser(next: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/logga-in?nasta=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser("/admin");
  if (!user.is_admin) redirect("/");
  return user;
}

export function safeNext(value: unknown, fallback = "/mina-projekt"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email);
}

async function startSession(userId: string): Promise<void> {
  const db = await getDb();
  const token = newToken();
  await db.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [hashToken(token), userId]);
  await db.query("delete from sessions where expires_at < now()");
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function registerUser(emailRaw: string, password: string, fullName: string): Promise<string> {
  const email = emailRaw.trim().toLowerCase();
  const db = await getDb();
  const [existing] = await db.query("select 1 from users where email = $1", [email]);
  if (existing) throw new UserError("Det finns redan ett konto med den e-postadressen. Logga in i stället.", { email: "Det finns redan ett konto med den e-postadressen." });
  const [{ id }] = await db.query<{ id: string }>(
    "insert into users (email, password_hash, full_name, is_admin) values ($1, $2, $3, $4::boolean) returning id",
    [email, await hashPassword(password), fullName.trim(), isAdminEmail(email)],
  );
  await startSession(id);
  return id;
}

const FAILED_LOGIN_LIMIT = 10;

export async function logIn(emailRaw: string, password: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const db = await getDb();
  const key = `login:${email}`;
  const [{ count }] = await db.query<{ count: number }>("select count(*)::int as count from login_attempts where key = $1 and at > now() - interval '15 minutes'", [key]);
  if (count >= FAILED_LOGIN_LIMIT) throw new UserError("För många försök. Vänta en kvart och försök igen.");
  const [user] = await db.query<{ id: string; password_hash: string }>("select id, password_hash from users where email = $1", [email]);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await db.query("insert into login_attempts (key) values ($1)", [key]);
    throw new UserError("Fel e-postadress eller lösenord.");
  }
  await db.query("delete from login_attempts where key = $1", [key]);
  await db.query("update users set is_admin = $2::boolean where id = $1", [user.id, isAdminEmail(email)]);
  await startSession(user.id);
}

export async function logOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await (await getDb()).query("delete from sessions where token_hash = $1", [hashToken(token)]);
  store.delete(COOKIE);
}

export async function sendPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const db = await getDb();
  const [user] = await db.query<{ id: string }>("select id from users where email = $1", [email]);
  if (!user) return; // The response must not reveal which addresses have accounts.
  const token = newToken();
  await db.query("insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 hour')", [hashToken(token), user.id]);
  const link = `${process.env.SITE_URL ?? "http://localhost:3100"}/nytt-losenord?kod=${token}`;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.log(`Länk för nytt lösenord: ${link}`);
    else console.error("RESEND_API_KEY saknas, mejl om nytt lösenord skickades inte");
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: email, subject: "Välj ett nytt lösenord", text: `Klicka på länken för att välja ett nytt lösenord. Den gäller i en timme.\n\n${link}` }),
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const db = await getDb();
  const [row] = await db.query<{ user_id: string }>(
    "update password_resets set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning user_id",
    [hashToken(token)],
  );
  if (!row) throw new UserError("Länken gäller inte längre. Beställ en ny.");
  await db.query("update users set password_hash = $2 where id = $1", [row.user_id, await hashPassword(password)]);
  await db.query("delete from sessions where user_id = $1", [row.user_id]);
  await startSession(row.user_id);
}
