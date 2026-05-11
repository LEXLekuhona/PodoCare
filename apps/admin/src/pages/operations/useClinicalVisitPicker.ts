import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canUseClinicalOperations } from '../../lib/roles';

import type { AppointmentRow, StudioRow } from './clinical-shared';

export type ClinicalVisitClientFilter = 'app' | 'any';

export function useClinicalVisitPicker(opts?: { clientFilter?: ClinicalVisitClientFilter }) {
  const clientFilter: ClinicalVisitClientFilter = opts?.clientFilter ?? 'any';
  const { user } = useAuth();
  const allowed = user ? canUseClinicalOperations(user.role) : false;
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [studioId, setStudioId] = useState('');
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId],
  );

  const loadStudios = useCallback(async () => {
    try {
      const data = await apiRequest<StudioRow[]>('/admin/catalog/studios');
      setStudios(data);
      if (!studioId && data[0]) setStudioId(data[0].id);
    } catch {
      setStudios([]);
    }
  }, [studioId]);

  const loadAppointments = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();
      const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      const q = new URLSearchParams();
      if (studioId.trim()) q.set('studioId', studioId.trim());
      q.set('from', from);
      q.set('to', to);
      const rows = await apiRequest<AppointmentRow[]>(`/appointments?${q.toString()}`);
      const withClients = rows.filter((item) =>
        clientFilter === 'app' ? Boolean(item.clientUserId) : Boolean(item.clientUserId || item.walkInClientId),
      );
      setAppointments(withClients);
      if (!withClients.some((item) => item.id === selectedAppointmentId)) {
        setSelectedAppointmentId(withClients[0]?.id ?? '');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить визиты');
      setAppointments([]);
      setSelectedAppointmentId('');
    } finally {
      setLoading(false);
    }
  }, [allowed, studioId, selectedAppointmentId, clientFilter]);

  useEffect(() => {
    if (!allowed) return;
    void loadStudios();
  }, [allowed, loadStudios]);

  useEffect(() => {
    if (!allowed) return;
    void loadAppointments();
  }, [allowed, loadAppointments]);

  return {
    allowed,
    studios,
    studioId,
    setStudioId,
    appointments,
    selectedAppointmentId,
    setSelectedAppointmentId,
    selectedAppointment,
    loading,
    loadAppointments,
    error,
    setError,
  };
}
