import { TRADE_LABEL, type JobType, type Trade } from "./job-requirements";

/** Fewer companies per job than the established marketplaces, so a quote is worth writing. */
export const MAX_COMPANIES_PER_TRADE = 3;

export interface CandidateCompany {
  id: string;
  name: string;
  description: string;
  trades: Trade[];
  postal_prefixes: string[];
  el_registration: string | null;
  wetroom_cert: string | null;
  has_f_skatt: boolean;
  has_insurance: boolean;
  status: string;
  accepting_jobs: boolean;
  min_job_sek: number;
  open_jobs: number;
}

export interface JobForMatching {
  postalPrefix: string;
  tradesNeeded: Trade[];
  jobTypes: JobType[];
  highEstimateSek: number;
}

export interface ScoredCompany {
  company: CandidateCompany;
  score: number;
  reasons: string[];
  trades: Trade[];
}

/** Rules that AI ranking can never overrule. */
export function isEligible(company: CandidateCompany, job: JobForMatching): boolean {
  if (company.status !== "approved" || !company.accepting_jobs) return false;
  if (!company.has_f_skatt || !company.has_insurance) return false;
  if (!company.postal_prefixes.includes(job.postalPrefix)) return false;
  if (company.min_job_sek > job.highEstimateSek) return false;
  return eligibleTrades(company, job).length > 0;
}

/** A company can only be invited for trades it is actually allowed to carry out. */
export function eligibleTrades(company: CandidateCompany, job: JobForMatching): Trade[] {
  return job.tradesNeeded.filter((trade) => company.trades.includes(trade) && (trade !== "el" || Boolean(company.el_registration)));
}

export function scoreCompany(company: CandidateCompany, job: JobForMatching): ScoredCompany {
  const trades = eligibleTrades(company, job);
  const labels = trades.map((trade) => TRADE_LABEL[trade].toLowerCase()).join(", ");
  const reasons = [`Utför ${labels} i ditt område`];
  let score = 40 + Math.round((trades.length / job.tradesNeeded.length) * 40);
  if (trades.length === job.tradesNeeded.length && trades.length > 1) reasons.push("Kan ta hela jobbet");
  if (job.jobTypes.includes("badrum") && company.wetroom_cert) {
    score += 20;
    reasons.push("Har våtrumsbehörighet");
  }
  if (trades.includes("el")) reasons.push("Registrerat elinstallationsföretag");
  score -= Math.min(company.open_jobs * 5, 30);
  return { company, score, reasons, trades };
}

/** Takes companies in order until every trade has its quota. Existing invitations count towards it. */
export function pickCompanies(ordered: ScoredCompany[], job: JobForMatching, alreadyInvited: Trade[][]): ScoredCompany[] {
  const counts = new Map<Trade, number>();
  for (const trades of alreadyInvited) for (const trade of trades) counts.set(trade, (counts.get(trade) ?? 0) + 1);
  const picked: ScoredCompany[] = [];
  for (const candidate of ordered) {
    const open = candidate.trades.filter((trade) => (counts.get(trade) ?? 0) < MAX_COMPANIES_PER_TRADE);
    if (!open.length) continue;
    for (const trade of open) counts.set(trade, (counts.get(trade) ?? 0) + 1);
    picked.push({ ...candidate, trades: open });
  }
  return picked;
}

export function isValidOrgNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  const sum = [...digits].reduce((total, char, index) => {
    const n = Number(char) * (index % 2 === 0 ? 2 : 1);
    return total + (n > 9 ? n - 9 : n);
  }, 0);
  return sum % 10 === 0;
}
