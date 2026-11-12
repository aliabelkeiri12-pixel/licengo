import { z } from "zod";

const name = z.string().trim().min(1, "Champ requis").max(80);
export const phoneFR = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .refine((v) => /^(\+33|0)[1-9]\d{8}$/.test(v), "Numéro de téléphone invalide");
export const postalCodeFR = z.string().trim().regex(/^\d{5}$/, "Code postal invalide (5 chiffres)");

export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), "Doit contenir majuscule, minuscule et chiffre");

export const signupSchema = z.object({
  firstName: name,
  lastName: name,
  email: z.string().trim().toLowerCase().email("Email invalide"),
  phone: phoneFR,
  password: passwordSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les CGU et la politique de confidentialité" }) }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const childSchema = z.object({
  firstName: name,
  lastName: name,
  birthDate: z.coerce
    .date({ errorMap: () => ({ message: "Date invalide" }) })
    .refine((d) => d <= new Date(), "Date dans le futur")
    .refine((d) => d.getFullYear() >= 1920, "Date invalide"),
  gender: z.enum(["M", "F"], { errorMap: () => ({ message: "Choisir un genre" }) }),
  birthPlace: z.string().trim().max(120).optional().or(z.literal("")),
  nationality: z.string().trim().max(60).optional().or(z.literal("")),
  isSelf: z.boolean().optional(), // adult registering him/herself
});

export const addressSchema = z.object({
  address: z.string().trim().min(3).max(200),
  postalCode: postalCodeFR,
  city: z.string().trim().min(1).max(100),
});

export const registrationCreateSchema = z.object({
  childId: z.string().min(1),
  categoryId: z.string().min(1),
  extraIds: z.array(z.string()).max(20).optional(),
});

export const installmentsSchema = z.coerce.number().int().min(1).max(4);

export const decisionSchema = z.object({
  decision: z.enum(["VALIDATE", "REJECT", "REQUEST_CHANGES"]),
  reason: z.string().trim().max(1000).optional(),
}).refine((d) => d.decision === "VALIDATE" || (d.reason && d.reason.length >= 3), { message: "Un motif est obligatoire", path: ["reason"] });
