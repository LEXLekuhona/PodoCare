export type SupportTicketKind = 'CONTACT' | 'REVIEW';

export type CreateSupportTicketRequest = {
  kind: SupportTicketKind;
  /**
   * Короткая тема. Для отзывов можно слать "Отзыв о визите".
   */
  subject: string;
  /**
   * Текст сообщения/отзыва.
   */
  message: string;
  /**
   * Опционально: если отзыв/обращение связано с конкретной студией.
   */
  studioId?: string;
};

export type CreateSupportTicketResponse = {
  ticketId: string;
};

