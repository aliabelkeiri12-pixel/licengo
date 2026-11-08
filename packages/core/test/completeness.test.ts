import { describe, expect, it } from "vitest";
import { evaluateCompleteness, footballCategoryFor, getSport, defaultFootballCategories, signupSchema, childSchema, decisionSchema, canTransition, haversineKm } from "../src";

const rules = getSport("football")!.rules;
const ref = new Date("2026-09-01T00:00:00Z");
const u11 = { name: "U11", birthYearMin: 2016, birthYearMax: 2017 };
const child = { firstName: "Léo", lastName: "Martin", birthDate: new Date("2016-05-10T00:00:00Z"), gender: "M" as const };

describe("evaluateCompleteness", () => {
  it("dossier vide d'un mineur : incomplet avec la liste des pièces", () => {
    const r = evaluateCompleteness({ child, category: u11, rules, documents: [], signatures: [], referenceDate: ref });
    expect(r.state).toBe("INCOMPLETE");
    expect(r.missingUploads.sort()).toEqual(["ID_DOCUMENT", "PHOTO"]);
    expect(r.missingSignatures.sort()).toEqual(["CLUB_RULES", "HEALTH_QUESTIONNAIRE", "PARENTAL_AUTHORIZATION"]);
    expect(r.progress).toBe(0);
  });

  it("dossier complet", () => {
    const r = evaluateCompleteness({
      child, category: u11, rules, referenceDate: ref,
      documents: [{ type: "PHOTO", status: "PENDING" }, { type: "ID_DOCUMENT", status: "ACCEPTED" }],
      signatures: ["CLUB_RULES", "HEALTH_QUESTIONNAIRE", "PARENTAL_AUTHORIZATION"],
    });
    expect(r.state).toBe("COMPLETE");
    expect(r.progress).toBe(100);
  });

  it("mineur ayant répondu OUI au questionnaire : certificat médical exigé", () => {
    const r = evaluateCompleteness({ child, category: u11, rules, documents: [], signatures: [], healthAnswer: "SOME_YES", referenceDate: ref });
    expect(r.missingUploads).toContain("MEDICAL_CERTIFICATE");
    expect(r.missingSignatures).not.toContain("HEALTH_QUESTIONNAIRE");
  });

  it("adulte : certificat requis, pas d'autorisation parentale", () => {
    const adult = { ...child, birthDate: new Date("1990-01-01T00:00:00Z") };
    const r = evaluateCompleteness({ child: adult, category: { name: "Seniors", birthYearMin: 1960, birthYearMax: 2008 }, rules, documents: [], signatures: [], referenceDate: ref });
    expect(r.missingUploads).toContain("MEDICAL_CERTIFICATE");
    expect(r.missingSignatures).not.toContain("PARENTAL_AUTHORIZATION");
  });

  it("détecte âge incompatible, document refusé et certificat expiré → à corriger", () => {
    const r = evaluateCompleteness({
      child: { ...child, birthDate: new Date("2012-01-01T00:00:00Z") }, category: u11, rules, referenceDate: ref, healthAnswer: "SOME_YES",
      documents: [
        { type: "PHOTO", status: "REJECTED", rejectReason: "Photo floue" },
        { type: "ID_DOCUMENT", status: "ACCEPTED" },
        { type: "MEDICAL_CERTIFICATE", status: "ACCEPTED", expiresAt: new Date("2026-01-01") },
      ],
      signatures: ["CLUB_RULES", "PARENTAL_AUTHORIZATION"],
    });
    expect(r.state).toBe("TO_FIX");
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["CATEGORY_AGE", "DOC_REJECTED_PHOTO", "DOC_EXPIRED_MEDICAL_CERTIFICATE"]));
    expect(r.summary.join(" ")).toContain("Photo floue");
  });

  it("détecte une date de naissance manquante", () => {
    const r = evaluateCompleteness({ child: { ...child, birthDate: null }, category: u11, rules, documents: [], signatures: [], referenceDate: ref });
    expect(r.state).toBe("TO_FIX");
  });
});

describe("catégories & divers", () => {
  it("catégories FFF", () => {
    expect(footballCategoryFor(new Date("2016-03-01"), 2026)).toBe("U11");
    expect(footballCategoryFor(new Date("2000-03-01"), 2026)).toBe("Seniors");
    const cats = defaultFootballCategories(2026);
    expect(cats.find((c) => c.name === "U11")).toMatchObject({ birthYearMin: 2016, birthYearMax: 2017 });
  });
  it("validation des formulaires", () => {
    expect(signupSchema.safeParse({ firstName: "A", lastName: "B", email: "a@b.fr", phone: "06 12 34 56 78", password: "Motdepasse1", acceptTerms: true }).success).toBe(true);
    expect(signupSchema.safeParse({ firstName: "A", lastName: "B", email: "a@b.fr", phone: "12", password: "faible", acceptTerms: false }).success).toBe(false);
    expect(childSchema.safeParse({ firstName: "A", lastName: "B", birthDate: "2999-01-01", gender: "M" }).success).toBe(false);
    expect(decisionSchema.safeParse({ decision: "REJECT" }).success).toBe(false);
    expect(decisionSchema.safeParse({ decision: "VALIDATE" }).success).toBe(true);
  });
  it("transitions de statut", () => {
    expect(canTransition("SUBMITTED", "VALIDATED")).toBe(true);
    expect(canTransition("REJECTED", "VALIDATED")).toBe(false);
  });
  it("distance Paris–Lyon ≈ 392 km", () => {
    expect(Math.round(haversineKm(48.8566, 2.3522, 45.764, 4.8357))).toBeGreaterThan(385);
  });
});
