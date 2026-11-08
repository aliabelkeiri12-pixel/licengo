export const DOCUMENT_TYPES = [
  "PHOTO",
  "ID_DOCUMENT",
  "MEDICAL_CERTIFICATE",
  "HEALTH_QUESTIONNAIRE",
  "PARENTAL_AUTHORIZATION",
  "PROOF_OF_ADDRESS",
  "IMAGE_RIGHTS",
  "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  PHOTO: "Photo d'identité",
  ID_DOCUMENT: "Pièce d'identité / livret de famille",
  MEDICAL_CERTIFICATE: "Certificat médical",
  HEALTH_QUESTIONNAIRE: "Attestation questionnaire de santé",
  PARENTAL_AUTHORIZATION: "Autorisation parentale",
  PROOF_OF_ADDRESS: "Justificatif de domicile",
  IMAGE_RIGHTS: "Autorisation droit à l'image",
  OTHER: "Autre justificatif",
};

/** Documents considered "sensitive" (RGPD art. 9 health data, identity) → stricter access & retention. */
export const SENSITIVE_DOCUMENTS: DocumentType[] = ["ID_DOCUMENT", "MEDICAL_CERTIFICATE", "HEALTH_QUESTIONNAIRE"];

/** Some documents are "signed" in the app instead of uploaded. */
export const SIGNABLE_DOCUMENTS = ["PARENTAL_AUTHORIZATION", "IMAGE_RIGHTS", "CLUB_RULES", "HEALTH_QUESTIONNAIRE"] as const;
export type SignableDocument = (typeof SIGNABLE_DOCUMENTS)[number];
export const SIGNATURE_LABELS: Record<SignableDocument, string> = {
  PARENTAL_AUTHORIZATION: "Autorisation parentale (soins d'urgence, transport)",
  IMAGE_RIGHTS: "Autorisation de droit à l'image",
  CLUB_RULES: "Règlement intérieur du club",
  HEALTH_QUESTIONNAIRE: "Attestation : réponse NON à toutes les questions du questionnaire de santé",
};

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function isAllowedUpload(mime: string, size: number): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED_MIME_TYPES.includes(mime)) return { ok: false, reason: "Format non accepté (JPG, PNG, WEBP, HEIC ou PDF)" };
  if (size <= 0) return { ok: false, reason: "Fichier vide" };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, reason: "Fichier trop volumineux (10 Mo maximum)" };
  return { ok: true };
}
