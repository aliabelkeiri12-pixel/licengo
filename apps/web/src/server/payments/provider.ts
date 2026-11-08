export interface CheckoutArgs {
  paymentId: string;
  installmentId: string;
  description: string;
  amountCents: number;
  platformFeeCents: number;
  clubStripeAccountId: string | null;
  customerEmail: string;
  saveForFuture: boolean; // 2x/3x/4x → save card for off-session charges
  successUrl: string;
  cancelUrl: string;
}

export interface OffSessionArgs {
  installmentId: string;
  amountCents: number;
  platformFeeCents: number;
  clubStripeAccountId: string | null;
  customerId: string | null;
  paymentMethodId: string | null;
  description: string;
}

export type ChargeResult =
  | { status: "succeeded"; intentId: string }
  | { status: "processing"; intentId: string }
  | { status: "failed"; intentId?: string; reason: string };

export interface RefundArgs { intentId: string; amountCents: number; refundApplicationFee: boolean }

export interface PaymentProvider {
  readonly name: "stripe" | "mock";
  createCheckout(a: CheckoutArgs): Promise<{ url: string; sessionId: string }>;
  chargeOffSession(a: OffSessionArgs): Promise<ChargeResult>;
  refund(a: RefundArgs): Promise<{ id: string; status: "succeeded" | "pending" | "failed" }>;
  createConnectedAccount(club: { name: string; email?: string | null }): Promise<string>;
  onboardingLink(accountId: string, returnUrl: string): Promise<string>;
}
