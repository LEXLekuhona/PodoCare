export type StudioRow = {
  id: string;
  name: string;
  city: string;
};

export type AppointmentRow = {
  id: string;
  studioId: string;
  serviceId: string;
  clientUserId: string | null;
  walkInClientId?: string | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  walkIn?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    linkedUserId?: string | null;
  } | null;
  specialistId: string;
  startsAt: string;
  endsAt?: string;
  status: string;
  service?: { id: string; name: string } | null;
  studio?: { id: string; name: string; city: string } | null;
  specialist?: {
    id: string;
    user: { firstName: string; lastName: string };
  } | null;
};

export type VisitSaleServiceRow = { id: string; name: string; priceMinor: number; durationMinutes: number };
export type VisitSaleGoodRow = { id: string; name: string; priceMinor: number; stock: number | null };

export type VisitSaleCatalog = {
  services: VisitSaleServiceRow[];
  physicalGoods: VisitSaleGoodRow[];
};

export type VisitOrderRow = {
  id: string;
  /** Человекочитаемый номер (например SR-m…), не путать с UUID заказа. */
  orderNumber: string;
  status: string;
  totalMinor: number;
  appointmentId: string | null;
  items: Array<{
    id: string;
    productType: string;
    nameSnapshot: string;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }>;
  payments?: Array<{ id: string; status: string; method: string | null; confirmationUrl: string | null }>;
};

export type InvoiceDraftLine = {
  key: string;
  productType: 'SERVICE' | 'PHYSICAL_GOOD';
  refId: string;
  quantity: number;
};

export type BookingSlotOption = { startsAt: string; label: string; dateLabel: string };

export function appointmentStatusRu(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Ожидает подтверждения',
    CONFIRMED: 'Подтверждён',
    IN_PROGRESS: 'Идёт приём',
    COMPLETED: 'Завершён',
    NO_SHOW: 'Не явился',
    CANCELLED_BY_CLIENT: 'Отменён клиентом',
    CANCELLED_BY_STUDIO: 'Отменён студией',
    CANCELLED: 'Отменён',
  };
  return map[status] ?? status;
}

/** Статус для списков: после окончания слота не показываем «Идёт приём», если запись ещё не закрыта в БД. */
export function appointmentStatusLabelForPicker(status: string, endsAtIso?: string | null): string {
  if (status === 'IN_PROGRESS' && endsAtIso) {
    const end = new Date(endsAtIso).getTime();
    if (!Number.isNaN(end) && Date.now() >= end) {
      return appointmentStatusRu('COMPLETED');
    }
  }
  return appointmentStatusRu(status);
}

export function formatRub(minor: number): string {
  return `${(minor / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export function orderStatusRu(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'В обработке',
    AWAITING_PAYMENT: 'Ожидает оплаты',
    PAID: 'Оплачен',
    SHIPPED: 'Отправлен',
    COMPLETED: 'Завершён',
    CANCELLED: 'Отменён',
    REFUNDED: 'Возврат',
  };
  return map[status] ?? status;
}
