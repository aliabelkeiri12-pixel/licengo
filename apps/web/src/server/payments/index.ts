import { env } from "../env";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./provider";

export const paymentProvider = (): PaymentProvider => (env.stripeSecretKey ? stripeProvider : mockProvider);
export * from "./provider";
