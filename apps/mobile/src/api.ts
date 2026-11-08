import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

/** API base: EXPO_PUBLIC_API_URL (set per EAS profile) or app.json extra.apiUrl. */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:3000";
const TOKEN_KEY = "licengo.session";

let token: string | null = null;
export async function loadToken() { token = await SecureStore.getItemAsync(TOKEN_KEY); return token; }
export async function saveToken(t: string | null) {
  token = t;
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (init.form) body = init.form as unknown as BodyInit;
  else if (init.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(init.body); }
  const res = await fetch(`${API_URL}/api/v1${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "Erreur réseau", res.status);
  return data as T;
}

export type Me = { user: { id: string; firstName: string; lastName: string; email: string; role: string }; unread: number; children: Child[] };
export type Child = { id: string; firstName: string; lastName: string; birthDate: string; gender: "M" | "F"; registrations: { id: string; status: string; paymentStatus: string; progress: number; season: string; club: { name: string; slug: string; primaryColor: string }; category: { name: string } }[] };
