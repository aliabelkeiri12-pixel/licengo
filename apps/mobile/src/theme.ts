export const colors = {
  pitch950: "#04130D", pitch900: "#0A2A1F", pitch800: "#0B3D2E", pitch700: "#12523E", pitch600: "#1B6B52", pitch50: "#EEF7F2",
  volt: "#C6F432", chalk: "#F6F5F1", ink: "#0E1512", muted: "#5B6B64", line: "#E3E6E1", danger: "#C2362B", warning: "#C77700", white: "#FFFFFF",
};
export const radius = { md: 12, lg: 16, xl: 20 };
export const statusLabel: Record<string, [string, string]> = {
  DRAFT: ["Brouillon", colors.muted], SUBMITTED: ["Complet – à valider", "#1F5FBF"], INCOMPLETE: ["Incomplet", colors.warning],
  TO_FIX: ["À corriger", colors.danger], VALIDATED: ["Validé", colors.pitch600], REJECTED: ["Refusé", colors.danger], CANCELLED: ["Annulé", colors.muted],
};
