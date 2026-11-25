
import type { EmailRow, Sender } from "./types";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Generic API request handler
async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    throw new Error(
      error.message || `Request failed (${response.status})`
    );
  }

  return response.json();
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export const api = {
  // Authentication
  me: () =>
    request<{ user: AuthUser | null }>("/api/auth/me"),

  logout: () =>
    request<{ loggedOut: boolean }>("/api/auth/logout", {
      method: "POST"
    }),

  // Email operations
  scheduled: () =>
    request<EmailRow[]>("/api/emails/scheduled"),

  sent: () =>
    request<EmailRow[]>("/api/emails/sent"),

  search: (query: string) =>
    request<any[]>(`/api/emails/search?q=${encodeURIComponent(query)}`),

  // Sender operations
  senders: () =>
    request<Sender[]>("/api/senders"),

  addSender: (data: unknown) =>
    request<Sender>("/api/senders", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Campaign operations
  createCampaign: (data: unknown) =>
    request<{ campaignId: string; total: number }>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Slack integration
  testSlack: () =>
    request<{ sent: boolean; channel: string; message: string }>(
      "/api/slack/test",
      { method: "POST" }
    )
};

export const apiBase = API;
