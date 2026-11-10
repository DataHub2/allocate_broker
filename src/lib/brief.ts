import { z } from "zod";
import { TRADES } from "./job-requirements";

export const tradeSchema = z.enum(TRADES);

export const briefSchema = z.object({
  title: z.string(),
  summary: z.string(),
  scope: z.array(
    z.object({
      trade: tradeSchema,
      items: z.array(
        z.object({
          task: z.string(),
          detail: z.string(),
          quantity: z.string().nullable(),
          unit: z.string().nullable(),
          basis: z.enum(["customer", "photo", "assumption"]),
        }),
      ),
    }),
  ),
  materials: z.array(z.object({ item: z.string(), supplied_by: z.enum(["contractor", "customer", "unclear"]) })),
  unknowns: z.array(z.object({ question: z.string(), why_it_matters: z.string(), needs_site_visit: z.boolean() })),
  requirements: z.array(z.object({ title: z.string(), detail: z.string() })),
  price_estimate: z.object({
    low_sek: z.number().int(),
    high_sek: z.number().int(),
    labour_share_percent: z.number().int(),
    confidence: z.enum(["low", "medium", "high"]),
    basis: z.string(),
  }),
  quote_readiness: z.enum(["fixed_price_possible", "estimate_then_visit", "visit_required"]),
  quote_readiness_reason: z.string(),
  trades_needed: z.array(tradeSchema),
});

export type Brief = z.infer<typeof briefSchema>;

export const ROT = { rate: 0.3, capSek: 50_000 } as const;

export function rotDeduction(labourSek: number): number {
  return Math.min(Math.round(labourSek * ROT.rate), ROT.capSek);
}

/** One group per trade, so every quote line has a unique reference. */
export function mergeScope(brief: Brief): Brief {
  const groups = new Map<string, Brief["scope"][number]>();
  for (const group of brief.scope) {
    const existing = groups.get(group.trade);
    if (existing) existing.items.push(...group.items);
    else groups.set(group.trade, { trade: group.trade, items: [...group.items] });
  }
  const scope = [...groups.values()].filter((g) => g.items.length > 0);
  const trades = [...new Set([...brief.trades_needed, ...scope.map((g) => g.trade)])].filter((t) => scope.some((g) => g.trade === t));
  return { ...brief, scope, trades_needed: trades };
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE = /(?:\+46|0)[\s-]?\d(?:[\s-]?\d){6,11}/g;
const REMOVED = "[borttaget]";

/** The brief is shown to companies before the customer has chosen them, so nothing identifying may remain. */
export function scrubText(text: string, secrets: string[]): string {
  let out = text.replace(EMAIL, REMOVED).replace(PHONE, REMOVED);
  for (const secret of secrets) {
    const clean = secret.trim();
    if (clean.length < 3) continue;
    out = out.replace(new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), REMOVED);
  }
  return out;
}

export function scrubBrief(brief: Brief, secrets: string[]): Brief {
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return scrubText(value, secrets);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    return value;
  };
  return walk(brief) as Brief;
}

export const BASIS_LABEL = { customer: "Från dig", photo: "Från bild", assumption: "Antagande" } as const;
export const CONFIDENCE_LABEL = { low: "Låg säkerhet", medium: "Medelhög säkerhet", high: "Hög säkerhet" } as const;
export const READINESS_LABEL = {
  fixed_price_possible: "Går att ge fast pris utan besök",
  estimate_then_visit: "Går att ge ett prisförslag, fast pris kräver besök",
  visit_required: "Kräver besök innan pris",
} as const;

export interface QuoteLine {
  ref: string;
  trade: string;
  task: string;
}

/** Every company prices the same lines, so the customer can compare them row by row. */
export function quoteLines(brief: Brief, trades: string[]): QuoteLine[] {
  return brief.scope.flatMap((group) =>
    trades.includes(group.trade)
      ? group.items.map((item, index) => ({ ref: `${group.trade}:${index}`, trade: group.trade, task: item.task }))
      : [],
  );
}

export function formatSek(value: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}

/** Slots are stored as the customer typed them, local to the home. */
export function formatSlot(slot: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(slot);
  if (!match) return slot;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  const day = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(date);
  return `${day} kl. ${match[4]}`;
}
