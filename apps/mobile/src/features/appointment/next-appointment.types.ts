export type NextAppointmentDto = {
  id: string;
  startsAt: string;
  status: string;
  studio: {
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string | null;
  };
  specialist: {
    id: string;
    firstName: string;
    lastName: string;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
  };
};
