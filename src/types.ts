export type EmailRow = {
  id: string; recipient: string; subject: string; scheduledAt: string;
  sentAt?: string | null; status: "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";
  previewUrl?: string | null; lastError?: string | null;
};
export type Sender = { id: string; email: string };
