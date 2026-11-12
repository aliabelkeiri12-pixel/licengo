export const REGISTRATION_STATUSES = ["DRAFT", "SUBMITTED", "INCOMPLETE", "TO_FIX", "VALIDATED", "REJECTED", "CANCELLED"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Complet – à valider",
  INCOMPLETE: "Incomplet",
  TO_FIX: "À corriger",
  VALIDATED: "Validé",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: "Non payé",
  PARTIAL: "Paiement en cours",
  PAID: "Payé",
  LATE: "Impayé",
  REFUNDED: "Remboursé",
} as const;
export type PaymentStatus = keyof typeof PAYMENT_STATUS_LABELS;

export const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payée",
  PREPARING: "En préparation",
  SHIPPED: "Expédiée",
  READY_FOR_PICKUP: "Disponible au club",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS_LABELS;

/** Club secretary actions allowed per status. */
const transitions: Record<RegistrationStatus, RegistrationStatus[]> = {
  DRAFT: ["SUBMITTED", "INCOMPLETE", "CANCELLED"],
  INCOMPLETE: ["SUBMITTED", "TO_FIX", "REJECTED", "CANCELLED"],
  SUBMITTED: ["VALIDATED", "TO_FIX", "REJECTED", "INCOMPLETE"],
  TO_FIX: ["SUBMITTED", "INCOMPLETE", "REJECTED", "CANCELLED"],
  VALIDATED: ["TO_FIX", "CANCELLED"],
  REJECTED: ["TO_FIX"], // the club can reopen a file refused by mistake
  CANCELLED: [],
};
export const canTransition = (from: RegistrationStatus, to: RegistrationStatus) => transitions[from].includes(to);

export const ORDER_FLOW: OrderStatus[] = ["PAID", "PREPARING", "READY_FOR_PICKUP", "DELIVERED"];
