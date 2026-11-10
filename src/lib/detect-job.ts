/** A quick reading of what someone is typing, used only to bring the start page to life. The real classification is done by AI later. */
export type Zone = "bad" | "kok" | "el" | "vvs" | "tak" | "golv" | "mal" | "fasad" | "mark";

const RULES: { zone: Zone; trades: string[]; pattern: RegExp }[] = [
  { zone: "bad", trades: ["Bygg", "VVS"], pattern: /badrum|våtrum|dusch|kakel|klinker|toalett|\bwc\b|badkar/i },
  { zone: "kok", trades: ["Bygg", "VVS"], pattern: /kök|köks|diskho|diskmaskin/i },
  { zone: "el", trades: ["El"], pattern: /\bel\b|elcentral|elen|uttag|lampa|lampor|belysning|laddbox|elbil|säkring|jordfel|spotlight|golvvärme|proppar/i },
  { zone: "vvs", trades: ["VVS"], pattern: /\brör\b|rören|vvs|blandare|kran|stam|avlopp|värmepump|element|varmvatten|golvbrunn/i },
  { zone: "tak", trades: ["Tak"], pattern: /\btak\b|taket|takpann|hängränn|skorsten|plåttak/i },
  { zone: "golv", trades: ["Golv"], pattern: /parkett|laminat|\bgolv\b|golvet|slipa/i },
  { zone: "mal", trades: ["Måleri"], pattern: /måla|målning|tapet|spackl/i },
  { zone: "fasad", trades: ["Bygg"], pattern: /fasad|fönster|ytterdörr|panel|tillbyggnad|bärande/i },
  { zone: "mark", trades: ["Mark"], pattern: /altan|uppfart|stenläggning|gräv|dränering|trädgård|plattor/i },
];

export interface DetectedJob {
  zones: Zone[];
  trades: string[];
}

export function detectJob(text: string): DetectedJob {
  const hits = RULES.filter((rule) => rule.pattern.test(text));
  return {
    zones: hits.map((hit) => hit.zone),
    trades: [...new Set(hits.flatMap((hit) => hit.trades))].slice(0, 3),
  };
}
