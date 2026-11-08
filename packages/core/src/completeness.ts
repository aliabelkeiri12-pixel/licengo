import { DOCUMENT_LABELS, type DocumentType, type SignableDocument, SIGNATURE_LABELS } from "./documents";
import { ageAt, type SportRules } from "./sports";

export type DocStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type HealthAnswer = "ALL_NO" | "SOME_YES" | null | undefined;

export interface CompletenessInput {
  child: { firstName: string; lastName: string; birthDate: Date | null; gender?: "M" | "F" | null };
  category: { name: string; birthYearMin: number; birthYearMax: number; gender?: "MIXED" | "M" | "F" };
  rules: SportRules;
  documents: { type: DocumentType; status: DocStatus; expiresAt?: Date | null; rejectReason?: string | null }[];
  signatures: SignableDocument[];
  healthAnswer?: HealthAnswer;
  guardian?: { phone?: string | null; email?: string | null };
  referenceDate?: Date;
}

export interface Issue { code: string; message: string; field?: string }

export interface CompletenessResult {
  state: "COMPLETE" | "INCOMPLETE" | "TO_FIX";
  requiredUploads: DocumentType[];
  requiredSignatures: SignableDocument[];
  missingUploads: DocumentType[];
  missingSignatures: SignableDocument[];
  issues: Issue[];
  progress: number; // 0..100
  summary: string[];
}

export function requirementsFor(rules: SportRules, isMinor: boolean, healthAnswer: HealthAnswer) {
  const uploads = new Set<DocumentType>(rules.uploads);
  const signatures = new Set<SignableDocument>(rules.signatures);
  if (isMinor) {
    signatures.add("PARENTAL_AUTHORIZATION");
    if (rules.minorsQuestionnaireInsteadOfCertificate && healthAnswer !== "SOME_YES") signatures.add("HEALTH_QUESTIONNAIRE");
    else uploads.add("MEDICAL_CERTIFICATE");
  } else {
    uploads.add("MEDICAL_CERTIFICATE");
  }
  return { uploads: [...uploads], signatures: [...signatures] };
}

/** Automatic detection of missing documents and incorrect information on a registration file. */
export function evaluateCompleteness(input: CompletenessInput): CompletenessResult {
  const ref = input.referenceDate ?? new Date();
  const issues: Issue[] = [];
  const { child, category } = input;

  if (!child.firstName?.trim()) issues.push({ code: "CHILD_FIRSTNAME", message: "Prénom du licencié manquant", field: "firstName" });
  if (!child.lastName?.trim()) issues.push({ code: "CHILD_LASTNAME", message: "Nom du licencié manquant", field: "lastName" });

  let isMinor = true;
  if (!child.birthDate || Number.isNaN(child.birthDate.getTime())) {
    issues.push({ code: "BIRTHDATE_MISSING", message: "Date de naissance manquante", field: "birthDate" });
  } else if (child.birthDate > ref) {
    issues.push({ code: "BIRTHDATE_FUTURE", message: "Date de naissance dans le futur", field: "birthDate" });
  } else {
    isMinor = ageAt(child.birthDate, ref) < 18;
    const y = child.birthDate.getUTCFullYear();
    if (y < category.birthYearMin || y > category.birthYearMax)
      issues.push({
        code: "CATEGORY_AGE",
        message: `Année de naissance ${y} incompatible avec la catégorie ${category.name} (${category.birthYearMin}–${category.birthYearMax})`,
        field: "categoryId",
      });
  }
  if (category.gender && category.gender !== "MIXED" && child.gender && child.gender !== category.gender)
    issues.push({ code: "CATEGORY_GENDER", message: `La catégorie ${category.name} n'accepte pas ce genre`, field: "categoryId" });
  if (input.guardian && !input.guardian.phone)
    issues.push({ code: "GUARDIAN_PHONE", message: "Téléphone du responsable légal manquant", field: "phone" });

  const req = requirementsFor(input.rules, isMinor, input.healthAnswer);
  const missingUploads: DocumentType[] = [];
  for (const type of req.uploads) {
    const docs = input.documents.filter((d) => d.type === type);
    const usable = docs.filter((d) => d.status !== "REJECTED" && !(d.expiresAt && d.expiresAt < ref));
    if (usable.length > 0) continue;
    const rejected = docs.find((d) => d.status === "REJECTED");
    const expired = docs.find((d) => d.expiresAt && d.expiresAt < ref);
    if (rejected)
      issues.push({ code: `DOC_REJECTED_${type}`, message: `${DOCUMENT_LABELS[type]} refusé${rejected.rejectReason ? ` : ${rejected.rejectReason}` : ""}` });
    else if (expired) issues.push({ code: `DOC_EXPIRED_${type}`, message: `${DOCUMENT_LABELS[type]} expiré` });
    else missingUploads.push(type);
  }
  const missingSignatures = req.signatures.filter((s) => !input.signatures.includes(s));

  const total = req.uploads.length + req.signatures.length;
  const done = total - missingUploads.length - missingSignatures.length - issues.filter((i) => i.code.startsWith("DOC_")).length;
  const progress = total === 0 ? 100 : Math.round((Math.max(0, done) / total) * 100);

  const state = issues.length > 0 ? "TO_FIX" : missingUploads.length + missingSignatures.length > 0 ? "INCOMPLETE" : "COMPLETE";
  const summary = [
    ...issues.map((i) => i.message),
    ...missingUploads.map((t) => `À fournir : ${DOCUMENT_LABELS[t]}`),
    ...missingSignatures.map((s) => `À signer : ${SIGNATURE_LABELS[s]}`),
  ];
  return { state, requiredUploads: req.uploads, requiredSignatures: req.signatures, missingUploads, missingSignatures, issues, progress, summary };
}
