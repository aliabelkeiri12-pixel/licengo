import { NextResponse } from "next/server";
import { requireClubAccess } from "@/server/auth";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit";
import { currentSeason } from "@/server/services/registrations";
import { AppError } from "@/server/errors";

const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** CSV export of validated licensees (separator ';' for French Excel), ready for federation import. */
export async function GET() {
  try {
    const { user, clubId } = await requireClubAccess();
    const regs = await prisma.registration.findMany({ where: { clubId, season: currentSeason(), status: "VALIDATED" }, include: { child: { include: { family: { include: { guardians: true } } } }, category: true } });
    const header = ["Nom", "Prénom", "Date de naissance", "Sexe", "Lieu de naissance", "Nationalité", "Catégorie", "N° licence", "Responsable", "Email", "Téléphone", "Adresse", "Code postal", "Ville", "Droit image", "Paiement"];
    const rows = regs.map((r) => { const g = r.child.family.guardians[0]; return [r.child.lastName, r.child.firstName, r.child.birthDate.toISOString().slice(0, 10), r.child.gender, r.child.birthPlace, r.child.nationality, r.category.name, r.federationLicenseNumber, g ? `${g.firstName} ${g.lastName}` : "", g?.email, g?.phone, r.child.family.address, r.child.family.postalCode, r.child.family.city, r.imageRightsOk ? "Oui" : "Non", r.paymentStatus]; });
    await audit(user.id, "club.export", "Club", clubId, { count: regs.length });
    const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="licencies-${currentSeason()}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof AppError ? e.message : "Erreur" }, { status: e instanceof AppError ? e.status : 500 });
  }
}
