export class AppError extends Error {
  constructor(message: string, public status = 400, public code = "BAD_REQUEST") {
    super(message);
  }
}
export const notFound = (what = "Ressource") => new AppError(`${what} introuvable`, 404, "NOT_FOUND");
export const forbidden = () => new AppError("Accès refusé", 403, "FORBIDDEN");
export const unauthorized = () => new AppError("Authentification requise", 401, "UNAUTHORIZED");
