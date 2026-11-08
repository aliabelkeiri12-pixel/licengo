import type { DocumentType, SignableDocument } from "./documents";

export interface SportRules {
  /** Uploaded documents always required. */
  uploads: DocumentType[];
  /** Documents signed electronically in the app. */
  signatures: SignableDocument[];
  /** Minors: health questionnaire replaces the certificate (Code du sport, décret 2021-564). */
  minorsQuestionnaireInsteadOfCertificate: boolean;
  /** Validity of an adult medical certificate, in years. */
  certificateValidityYears: number;
  /** Month (1-12) when the season starts. */
  seasonStartMonth: number;
}

export interface SportDefinition {
  slug: string;
  name: string;
  federation: string;
  federationSystem?: string; // official licensing software of the federation
  active: boolean;
  emoji: string;
  rules: SportRules;
}

const baseRules: SportRules = {
  uploads: ["PHOTO", "ID_DOCUMENT"],
  signatures: ["CLUB_RULES"],
  minorsQuestionnaireInsteadOfCertificate: true,
  certificateValidityYears: 3,
  seasonStartMonth: 7,
};

/**
 * Sport catalogue. Football is live at launch; adding a sport = activating it here (and in DB),
 * with its own rules. No code change required in the registration engine.
 */
export const SPORTS: SportDefinition[] = [
  { slug: "football", name: "Football", federation: "FFF", federationSystem: "Footclubs", active: true, emoji: "⚽", rules: baseRules },
  { slug: "basketball", name: "Basketball", federation: "FFBB", federationSystem: "FBI / e-Licence", active: false, emoji: "🏀", rules: baseRules },
  { slug: "handball", name: "Handball", federation: "FFHandball", federationSystem: "Gest'hand", active: false, emoji: "🤾", rules: baseRules },
  { slug: "rugby", name: "Rugby", federation: "FFR", federationSystem: "Oval-e", active: false, emoji: "🏉", rules: { ...baseRules, minorsQuestionnaireInsteadOfCertificate: false, certificateValidityYears: 1 } },
  { slug: "volleyball", name: "Volley-ball", federation: "FFVolley", active: false, emoji: "🏐", rules: baseRules },
  { slug: "tennis", name: "Tennis", federation: "FFT", federationSystem: "ADOC / Ten'Up", active: false, emoji: "🎾", rules: { ...baseRules, seasonStartMonth: 9 } },
  { slug: "judo", name: "Judo", federation: "FFJDA", federationSystem: "Extranet FFJDA", active: false, emoji: "🥋", rules: { ...baseRules, seasonStartMonth: 9 } },
];

export const getSport = (slug: string) => SPORTS.find((s) => s.slug === slug);

/** Season start year for a date: a football season 2026-2027 starts on July 1st 2026. */
export function seasonStartYear(date: Date, seasonStartMonth = 7): number {
  const y = date.getUTCFullYear();
  return date.getUTCMonth() + 1 >= seasonStartMonth ? y : y - 1;
}
export const seasonLabel = (startYear: number) => `${startYear}-${startYear + 1}`;

/** Age at the reference date (default: today). */
export function ageAt(birthDate: Date, at: Date = new Date()): number {
  let age = at.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = at.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

/** FFF-style age category: U(x) where x = season end year − birth year. Seniors from U20. */
export function footballCategoryFor(birthDate: Date, seasonStart: number): string {
  const u = seasonStart + 1 - birthDate.getUTCFullYear();
  if (u < 5) return "Trop jeune";
  if (u >= 20) return u >= 35 ? "Vétérans" : "Seniors";
  return `U${u}`;
}

/** Default football categories for a club season (grouped by 2 years, as most clubs do). */
export function defaultFootballCategories(seasonStart: number) {
  const end = seasonStart + 1;
  const groups: { name: string; minU: number; maxU: number; priceCents: number }[] = [
    { name: "U7 (Débutants)", minU: 6, maxU: 7, priceCents: 12000 },
    { name: "U9", minU: 8, maxU: 9, priceCents: 13000 },
    { name: "U11", minU: 10, maxU: 11, priceCents: 15000 },
    { name: "U13", minU: 12, maxU: 13, priceCents: 15000 },
    { name: "U15", minU: 14, maxU: 15, priceCents: 16000 },
    { name: "U18", minU: 16, maxU: 18, priceCents: 17000 },
    { name: "Seniors", minU: 19, maxU: 34, priceCents: 19000 },
  ];
  return groups.map((g) => ({ name: g.name, birthYearMin: end - g.maxU, birthYearMax: end - g.minU, priceCents: g.priceCents }));
}
