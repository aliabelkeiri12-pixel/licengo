export const colors = {
  pitch950: "#060B17", pitch900: "#0B1426", pitch800: "#0B1426", pitch700: "#17843A", pitch600: "#1E9E46", pitch50: "#EBFAF0",
  volt: "#35CF5B", chalk: "#F3F5F9", ink: "#0B1220", muted: "#5A6478", line: "#E3E7EF", danger: "#C2362B", warning: "#C77700", white: "#FFFFFF",
};
export const radius = { md: 12, lg: 16, xl: 20 };
export const statusLabel: Record<string, [string, string]> = {
  DRAFT: ["Brouillon", colors.muted], SUBMITTED: ["Complet – à valider", "#1F5FBF"], INCOMPLETE: ["Incomplet", colors.warning],
  TO_FIX: ["À corriger", colors.danger], VALIDATED: ["Validé", colors.pitch600], REJECTED: ["Refusé", colors.danger], CANCELLED: ["Annulé", colors.muted],
};
