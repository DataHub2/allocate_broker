"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAi } from "@/lib/ai";
import { currentUser, logIn, logOut, registerUser, requireAdmin, requireUser, resetPassword, safeNext, sendPasswordReset } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkDeepSeekKey, DEEPSEEK_SECRET, setSecret } from "@/lib/settings";
import { TRADES, type Trade } from "@/lib/job-requirements";
import {
  acceptQuote, adminCompanySchema, approveBrief, basicsSchema, companyInvite, companySchema, confirmVisit, createCompany, createCompanyByAdmin, createProject, declineJob, declineQuote, declineVisit,
  finishQuestions, generateQuestions, NotFound, quoteSchema, rematchOpenProjects, requestVisit, reviseBrief, saveAnswer, saveBasics, saveBriefEdits, setCompanyStatus, submitQuote, switchToQuotes, UserError,
} from "@/lib/marketplace";
import type { FormState } from "@/components/forms";

const text = (fd: FormData, name: string) => String(fd.get(name) ?? "");
const optional = (fd: FormData, name: string) => text(fd, name).trim() || null;

/** Turns expected failures into form errors. Returns null when the work succeeded. */
async function attempt(fn: () => Promise<void>): Promise<FormState | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof UserError) return { error: error.message, fields: error.fields };
    if (error instanceof z.ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) fields[issue.path.join(".")] ??= issue.message;
      return { error: "Några uppgifter behöver rättas.", fields };
    }
    if (error instanceof NotFound) return { error: "Det här finns inte längre, eller så saknar du behörighet." };
    throw error;
  }
}

const accountSchema = z.object({
  full_name: z.string().trim().min(2, "Skriv ditt namn.").max(80),
  email: z.email("Skriv en giltig e-postadress."),
  password: z.string().min(10, "Lösenordet behöver vara minst 10 tecken.").max(200),
});

export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  const result = await attempt(async () => {
    const input = accountSchema.parse({ full_name: text(fd, "full_name"), email: text(fd, "email"), password: text(fd, "password") });
    await registerUser(input.email, input.password, input.full_name);
  });
  if (result) return result;
  redirect(safeNext(fd.get("next")));
}

export async function signInAction(_: FormState, fd: FormData): Promise<FormState> {
  const result = await attempt(() => logIn(text(fd, "email"), text(fd, "password")));
  if (result) return result;
  redirect(safeNext(fd.get("next")));
}

export async function signOutAction(): Promise<void> {
  await logOut();
  redirect("/");
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  await sendPasswordReset(text(fd, "email"));
  return { message: "Om adressen finns hos oss har vi skickat en länk. Den gäller i en timme." };
}

export async function newPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const result = await attempt(async () => {
    const password = z.string().min(10, "Lösenordet behöver vara minst 10 tecken.").safeParse(text(fd, "password"));
    if (!password.success) throw new UserError("Lösenordet är för kort.", { password: "Lösenordet behöver vara minst 10 tecken." });
    await resetPassword(text(fd, "token"), password.data);
  });
  if (result) return result;
  redirect(safeNext(fd.get("next")));
}

export async function createProjectAction(description: string): Promise<{ id?: string; error?: string }> {
  const user = await requireUser("/nytt-projekt");
  try {
    return { id: await createProject(await getDb(), user.id, description) };
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }
}

function basicsFrom(fd: FormData) {
  const approval = optional(fd, "approval_status");
  return basicsSchema.parse({
    postal_code: text(fd, "postal_code"),
    city: text(fd, "city"),
    street_address: text(fd, "street_address"),
    contact_name: text(fd, "contact_name"),
    phone: text(fd, "phone"),
    housing_type: optional(fd, "housing_type") ?? undefined,
    year_built: fd.get("year_unknown") ? null : text(fd, "year_built") ? Number(text(fd, "year_built")) : null,
    desired_start: text(fd, "desired_start"),
    budget_band: optional(fd, "budget_band"),
    wants_rot: fd.get("wants_rot") ? text(fd, "wants_rot") === "ja" : undefined,
    readiness: optional(fd, "readiness") ?? undefined,
    is_decision_maker: fd.get("is_decision_maker") ? text(fd, "is_decision_maker") === "ja" : undefined,
    approval_status: approval ?? "not_needed",
    financing_status: optional(fd, "financing_status") ?? undefined,
    price_model: optional(fd, "price_model") ?? undefined,
    access: {
      floor: text(fd, "floor"), elevator: text(fd, "elevator"), parking: text(fd, "parking"), container: text(fd, "container"),
      occupied: text(fd, "occupied"), water_wc: text(fd, "water_wc"), pets: text(fd, "pets"), blocked_hours: text(fd, "blocked_hours"),
    },
  });
}

export async function saveBasicsAction(projectId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(`/projekt/${projectId}`);
  const db = await getDb();
  const result = await attempt(async () => {
    await saveBasics(db, user.id, projectId, basicsFrom(fd));
    await generateQuestions(db, await getAi(), user.id, projectId);
  });
  if (result) return result;
  revalidatePath(`/projekt/${projectId}`);
  return {};
}

export async function saveAnswerAction(questionId: string, answer: string | string[] | null, unknown: boolean): Promise<boolean> {
  const user = await requireUser("/mina-projekt");
  try {
    await saveAnswer(await getDb(), user.id, questionId, answer, unknown);
    return true;
  } catch {
    return false;
  }
}

export async function finishQuestionsAction(projectId: string, _: FormState): Promise<FormState> {
  const user = await requireUser(`/projekt/${projectId}`);
  const result = await attempt(async () => {
    await finishQuestions(await getDb(), await getAi(), user.id, projectId);
  });
  if (result) return result;
  revalidatePath(`/projekt/${projectId}`);
  return {};
}

export async function saveBriefAction(projectId: string, content: unknown): Promise<{ error?: string }> {
  const user = await requireUser(`/projekt/${projectId}`);
  const result = await attempt(async () => saveBriefEdits(await getDb(), user.id, projectId, content));
  return result?.error ? { error: result.error } : {};
}

export async function reviseBriefAction(projectId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(`/projekt/${projectId}`);
  const result = await attempt(async () => reviseBrief(await getDb(), await getAi(), user.id, projectId, text(fd, "instruction")));
  if (result) return result;
  revalidatePath(`/projekt/${projectId}`);
  return { message: "Underlaget är uppdaterat." };
}

export async function switchToQuotesAction(projectId: string): Promise<void> {
  const user = await requireUser(`/projekt/${projectId}`);
  await switchToQuotes(await getDb(), user.id, projectId);
  revalidatePath(`/projekt/${projectId}`);
}

export async function approveBriefAction(projectId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(`/projekt/${projectId}`);
  const result = await attempt(async () =>
    approveBrief(await getDb(), await getAi(), user.id, projectId, fd.getAll("slots").map(String), fd.get("promise") === "ja"),
  );
  if (result) return result;
  revalidatePath(`/projekt/${projectId}`);
  return {};
}

export async function confirmVisitAction(projectId: string, matchId: string): Promise<void> {
  const user = await requireUser(`/projekt/${projectId}`);
  await confirmVisit(await getDb(), user.id, matchId);
  revalidatePath(`/projekt/${projectId}`);
}

export async function declineVisitAction(projectId: string, matchId: string): Promise<void> {
  const user = await requireUser(`/projekt/${projectId}`);
  await declineVisit(await getDb(), user.id, matchId);
  revalidatePath(`/projekt/${projectId}`);
}

export async function acceptQuoteAction(projectId: string, matchId: string): Promise<void> {
  const user = await requireUser(`/projekt/${projectId}`);
  await acceptQuote(await getDb(), user.id, matchId);
  revalidatePath(`/projekt/${projectId}`);
}

export async function declineQuoteAction(projectId: string, matchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(`/projekt/${projectId}`);
  const result = await attempt(async () => declineQuote(await getDb(), user.id, matchId, text(fd, "reason")));
  if (result) return result;
  revalidatePath(`/projekt/${projectId}`);
  return {};
}

export async function applyCompanyAction(_: FormState, fd: FormData): Promise<FormState> {
  const result = await attempt(async () => {
    const input = companySchema.parse({
      name: text(fd, "name"),
      org_number: text(fd, "org_number"),
      description: text(fd, "description"),
      trades: fd.getAll("trades").map(String).filter((t): t is Trade => (TRADES as readonly string[]).includes(t)),
      postal_prefixes: [...new Set(text(fd, "postal_prefixes").split(/[\s,]+/).filter(Boolean))],
      el_registration: optional(fd, "el_registration"),
      wetroom_cert: optional(fd, "wetroom_cert"),
      has_f_skatt: fd.get("has_f_skatt") === "ja",
      has_insurance: fd.get("has_insurance") === "ja",
      min_job_sek: Number(text(fd, "min_job_sek") || 0),
    });
    const user = await currentUser();
    let userId = user?.id;
    if (!userId) {
      const account = accountSchema.parse({ full_name: text(fd, "full_name"), email: text(fd, "email"), password: text(fd, "password") });
      userId = await registerUser(account.email, account.password, account.full_name);
    }
    await createCompany(await getDb(), userId, input);
  });
  if (result) return result;
  redirect("/foretag");
}

export async function declineJobAction(matchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(`/foretag/jobb/${matchId}`);
  const result = await attempt(async () => declineJob(await getDb(), user.id, matchId, text(fd, "reason")));
  if (result) return result;
  revalidatePath(`/foretag/jobb/${matchId}`);
  return {};
}

export async function requestVisitAction(matchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(`/foretag/jobb/${matchId}`);
  const result = await attempt(async () => requestVisit(await getDb(), user.id, matchId, text(fd, "slot"), text(fd, "note")));
  if (result) return result;
  revalidatePath(`/foretag/jobb/${matchId}`);
  return {};
}

export async function submitQuoteAction(matchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(`/foretag/jobb/${matchId}`);
  const result = await attempt(async () => {
    const amounts: Record<string, { amount_sek: number; labour_sek: number }> = {};
    for (const [key, value] of fd.entries()) {
      const match = /^(amount|labour):(.+)$/.exec(key);
      if (!match) continue;
      amounts[match[2]] ??= { amount_sek: 0, labour_sek: 0 };
      amounts[match[2]][match[1] === "amount" ? "amount_sek" : "labour_sek"] = Math.max(0, Math.round(Number(String(value).replace(/\s/g, "")) || 0));
    }
    await submitQuote(await getDb(), user.id, matchId, quoteSchema.parse({
      price_model: text(fd, "price_model"), start_text: text(fd, "start_text"), duration_text: text(fd, "duration_text"), valid_until: text(fd, "valid_until"), terms: text(fd, "terms"), amounts,
    }));
  });
  if (result) return result;
  revalidatePath(`/foretag/jobb/${matchId}`);
  return {};
}

export async function saveAiKeyAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const key = text(fd, "deepseek_key").trim();
  if (!/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) return { error: "Nyckeln ser inte rätt ut. Den börjar med sk- och har inga mellanslag.", fields: { deepseek_key: "Klistra in hela nyckeln från DeepSeek." } };
  const check = await checkDeepSeekKey(key);
  if (check === "rejected") return { error: "DeepSeek godkände inte nyckeln. Kontrollera att du kopierat hela nyckeln och att den inte är borttagen.", fields: { deepseek_key: "DeepSeek godkände inte nyckeln." } };
  if (check === "unreachable") return { error: "Det gick inte att nå DeepSeek just nu, så nyckeln är inte sparad. Försök igen om en stund." };
  await setSecret(await getDb(), DEEPSEEK_SECRET, key);
  revalidatePath("/admin");
  return { message: "Nyckeln är sparad och fungerar. AI:n använder DeepSeek från och med nu." };
}

export async function removeAiKeyAction(): Promise<void> {
  await requireAdmin();
  await setSecret(await getDb(), DEEPSEEK_SECRET, null);
  revalidatePath("/admin");
}

function inviteLink(token: string): string {
  return `${process.env.SITE_URL ?? "http://localhost:3100"}/nytt-losenord?kod=${token}&valkommen=1`;
}

export async function addCompanyAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let token = "";
  let name = "";
  const result = await attempt(async () => {
    const input = adminCompanySchema.parse({
      name: text(fd, "name"),
      org_number: text(fd, "org_number"),
      contact_name: text(fd, "contact_name"),
      email: text(fd, "email").trim(),
      trades: fd.getAll("trades").map(String).filter((t): t is Trade => (TRADES as readonly string[]).includes(t)),
      postal_prefixes: [...new Set(text(fd, "postal_prefixes").split(/[\s,]+/).filter(Boolean))],
      el_registration: optional(fd, "el_registration"),
      checked: fd.get("checked") === "ja",
    });
    const db = await getDb();
    token = await createCompanyByAdmin(db, input);
    name = input.name;
    await rematchOpenProjects(db, await getAi());
  });
  if (result) return result;
  revalidatePath("/admin");
  return { message: `${name} är tillagt och godkänt. Skicka länken till kontaktpersonen, så väljer de ett eget lösenord. Länken gäller i 14 dagar och fungerar en gång.`, link: inviteLink(token), reset: true };
}

export async function companyInviteAction(companyId: string, _: FormState, _fd: FormData): Promise<FormState> {
  await requireAdmin();
  let token = "";
  const result = await attempt(async () => {
    token = await companyInvite(await getDb(), companyId);
  });
  if (result) return result;
  return { message: "Ny länk skapad. Den gäller i 14 dagar och fungerar en gång.", link: inviteLink(token) };
}

export async function setCompanyStatusAction(companyId: string, status: "approved" | "suspended"): Promise<void> {
  await requireAdmin();
  await setCompanyStatus(await getDb(), await getAi(), companyId, status);
  revalidatePath("/admin");
}
