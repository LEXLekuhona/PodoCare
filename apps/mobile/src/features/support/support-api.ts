import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type CreateSupportTicketPayload = {
  subject: string;
  message: string;
  studioId?: string;
};

export async function createSupportTicket(payload: CreateSupportTicketPayload): Promise<{ ticketId: string }> {
  return apiFetchJsonAuth<{ ticketId: string }>('/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

