import { UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { canManageStaff, canMutateTenantCatalog } from '../../lib/roles';
import { DeleteIcon } from '../../ui/DeleteIcon';
import EditIcon from '../../ui/EditIcon';
import { FilterBar } from '../../ui/FilterBar';

import type { FormEvent } from 'react';

interface StudioRow {
  id: string;
  networkId: string;
  name: string;
  city: string;
}

interface ServiceOption {
  id: string;
  studioId: string;
  name: string;
  durationMinutes: number;
  priceMinor: number;
  isActive: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
}

interface SpecialistRow {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  primaryStudioId: string | null;
  isActive: boolean;
  createdAt: string;
  specialistProfile: {
    specializations: string[];
    studios: { id: string; name: string; city: string }[];
    serviceIds: string[];
    categoryIds: string[];
  };
}

interface SpecialistFormState {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  middleName: string;
  specializationsText: string;
  selectedStudioIds: string[];
  primaryStudioId: string;
  selectedServiceIds: string[];
  selectedCategoryIds: string[];
  isActive: boolean;
}

interface ShiftRow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  studio: { id: string; name: string; city: string };
}

interface ShiftModalState {
  specialistId: string;
  specialistLabel: string;
  activeTab: 'single' | 'bulk' | 'list';
  listStudioId: string;
  showCancelled: boolean;
  calendarAnchorDate: string;
  selectedDate: string;
  studioOptions: { id: string; name: string; city: string }[];
  studioId: string;
  startsAtLocal: string;
  endsAtLocal: string;
  bulkFromDate: string;
  bulkToDate: string;
  bulkWeekdays: number[];
  bulkStartTime: string;
  bulkEndTime: string;
  editingShiftId: string | null;
  rows: ShiftRow[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

type SpecialistSortField = 'categories' | 'fullName' | 'studios' | 'phone';
type SortDirection = 'asc' | 'desc';

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.8" />
    </svg>
  );
}

function toggleStudioId(ids: string[], studioId: string, on: boolean): string[] {
  const set = new Set(ids);
  if (on) {
    set.add(studioId);
  } else {
    set.delete(studioId);
  }
  return [...set];
}

function toggleServiceId(ids: string[], serviceId: string, on: boolean): string[] {
  const set = new Set(ids);
  if (on) {
    set.add(serviceId);
  } else {
    set.delete(serviceId);
  }
  return [...set];
}

function toggleCategoryId(ids: string[], categoryId: string, on: boolean): string[] {
  const set = new Set(ids);
  if (on) {
    set.add(categoryId);
  } else {
    set.delete(categoryId);
  }
  return [...set];
}

function toDatetimeLocalDefault(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toDateInputDefault(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function shiftTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function shiftStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'scheduled') return 'Запланирована';
  if (normalized === 'cancelled') return 'Отменена';
  if (normalized === 'completed') return 'Завершена';
  return status;
}

function parseDateKey(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date();
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function shiftStatusTone(status: string): 'ok' | 'muted' | 'warn' | 'danger' {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'cancelled') return 'muted';
  if (normalized === 'completed') return 'muted';
  if (normalized === 'active') return 'ok';
  if (normalized === 'scheduled') return 'ok';
  return 'warn';
}

function startOfWeekMonday(date: Date): Date {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + offset);
  return base;
}

function buildTwoByTwoWeekdays(fromDate: string, toDate: string): number[] {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return [1, 2, 3, 4, 5];
  }
  // Для простого пресета 2/2 на уровне API есть только шаблон по weekday,
  // поэтому берём набор weekday по циклу "2 дня работа / 2 дня выходной"
  // относительно даты старта периода.
  const set = new Set<number>();
  const totalDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  for (let i = 0; i < totalDays; i++) {
    const work = i % 4 === 0 || i % 4 === 1;
    if (!work) continue;
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    set.add(d.getUTCDay());
  }
  return set.size > 0 ? [...set].sort((a, b) => a - b) : [1, 2, 3, 4, 5];
}

export function SpecialistsPage() {
  const { user } = useAuth();
  const manage = user ? canManageStaff(user.role) : false;
  const canFilterByStudio = user ? canMutateTenantCatalog(user.role) : false;
  const studioAdmin = user?.role === UserRole.StudioAdmin;
  const [searchParams, setSearchParams] = useSearchParams();

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [rows, setRows] = useState<SpecialistRow[]>([]);
  const [studioFilterId, setStudioFilterId] = useState(() => searchParams.get('studio') ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    form: SpecialistFormState;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [servicesForModal, setServicesForModal] = useState<ServiceOption[]>([]);
  const [shiftModal, setShiftModal] = useState<ShiftModalState | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [sortField, setSortField] = useState<SpecialistSortField>('categories');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const debouncedQuery = useDebouncedValue(searchQuery);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studioData, categoryData, list] = await Promise.all([
        apiRequest<StudioRow[]>('/admin/catalog/studios'),
        apiRequest<CategoryOption[]>('/admin/catalog/service-categories'),
        (() => {
          const q =
            canFilterByStudio && studioFilterId.trim() !== ''
              ? `?studioId=${encodeURIComponent(studioFilterId.trim())}`
              : '';
          return apiRequest<SpecialistRow[]>(`/admin/catalog/specialists${q}`);
        })(),
      ]);
      setStudios(studioData);
      setCategories(categoryData.filter((c) => c.isActive !== false));
      setRows(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [canFilterByStudio, studioFilterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedStudiosKey =
    modal == null ? '' : [...modal.form.selectedStudioIds].sort().join(',');

  useEffect(() => {
    if (!modal) {
      setServicesForModal([]);
      return;
    }
    const ids = modal.form.selectedStudioIds;
    if (ids.length === 0) {
      setServicesForModal([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const lists = await Promise.all(
          ids.map((sid) => apiRequest<ServiceOption[]>(`/admin/catalog/studios/${sid}/services`)),
        );
        if (!cancelled) {
          setServicesForModal(lists.flat());
        }
      } catch {
        if (!cancelled) {
          setServicesForModal([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modal, selectedStudiosKey]);

  useEffect(() => {
    setModal((m) => {
      if (!m) return m;
      if (servicesForModal.length === 0 && m.form.selectedServiceIds.length > 0) {
        return m;
      }
      const allowed = new Set(servicesForModal.map((s) => s.id));
      const next = m.form.selectedServiceIds.filter((id) => allowed.has(id));
      if (next.length === m.form.selectedServiceIds.length) return m;
      return { ...m, form: { ...m.form, selectedServiceIds: next } };
    });
  }, [servicesForModal]);

  const defaultSelectedStudios = useMemo(() => {
    if (studioAdmin && studios.length > 0) {
      return [studios[0]!.id];
    }
    return [];
  }, [studioAdmin, studios]);

  function defaultForm(): SpecialistFormState {
    const sel = defaultSelectedStudios;
    return {
      email: '',
      password: '',
      phone: '',
      firstName: '',
      lastName: '',
      middleName: '',
      specializationsText: '',
      selectedStudioIds: sel,
      primaryStudioId: sel[0] ?? '',
      selectedServiceIds: [],
      selectedCategoryIds: [],
      isActive: true,
    };
  }

  function openCreate() {
    setModal({ mode: 'create', form: defaultForm() });
  }

  function openEdit(row: SpecialistRow) {
    const sel = row.specialistProfile.studios.map((s) => s.id);
    const primary = row.primaryStudioId ?? sel[0] ?? '';
    setModal({
      mode: 'edit',
      id: row.id,
      form: {
        email: row.email ?? '',
        password: '',
        phone: row.phone,
        firstName: row.firstName,
        lastName: row.lastName,
        middleName: row.middleName ?? '',
        specializationsText: row.specialistProfile.specializations.join(', '),
        selectedStudioIds: sel.length > 0 ? sel : defaultSelectedStudios,
        primaryStudioId: primary,
        selectedServiceIds: row.specialistProfile.serviceIds ?? [],
        selectedCategoryIds: row.specialistProfile.categoryIds ?? [],
        isActive: row.isActive,
      },
    });
  }

  function setFormStudios(
    m: NonNullable<typeof modal>,
    nextIds: string[],
  ): NonNullable<typeof modal> {
    let primary = m.form.primaryStudioId;
    if (!nextIds.includes(primary)) {
      primary = nextIds[0] ?? '';
    }
    const nextServiceIds = nextIds.length === 0 ? [] : m.form.selectedServiceIds;
    return {
      ...m,
      form: {
        ...m.form,
        selectedStudioIds: nextIds,
        primaryStudioId: primary,
        selectedServiceIds: nextServiceIds,
      },
    };
  }

  async function submitModal(ev: FormEvent) {
    ev.preventDefault();
    if (!modal || !user) return;

    const studioIds = modal.form.selectedStudioIds;
    if (studioIds.length === 0) {
      setError('Выберите хотя бы одну студию');
      return;
    }
    if (!modal.form.primaryStudioId || !studioIds.includes(modal.form.primaryStudioId)) {
      setError('Укажите основную студию из отмеченных');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const mid = modal.form.middleName.trim();
      const specs = modal.form.specializationsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (modal.mode === 'create') {
        if (modal.form.password.length < 8) {
          setError('Пароль не короче 8 символов');
          setSaving(false);
          return;
        }
        await apiRequest('/admin/catalog/specialists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: modal.form.email.trim(),
            password: modal.form.password,
            phone: modal.form.phone.trim(),
            firstName: modal.form.firstName.trim(),
            lastName: modal.form.lastName.trim(),
            ...(mid ? { middleName: mid } : {}),
            studioIds,
            primaryStudioId: modal.form.primaryStudioId,
            ...(specs.length > 0 ? { specializations: specs } : {}),
            serviceIds: modal.form.selectedServiceIds,
            categoryIds: modal.form.selectedCategoryIds,
          }),
        });
      } else if (modal.id) {
        const patch: {
          email: string;
          phone: string;
          firstName: string;
          lastName: string;
          middleName: string | null;
          studioIds: string[];
          primaryStudioId: string;
          specializations: string[];
          isActive: boolean;
          serviceIds: string[];
          categoryIds: string[];
          password?: string;
        } = {
          email: modal.form.email.trim(),
          phone: modal.form.phone.trim(),
          firstName: modal.form.firstName.trim(),
          lastName: modal.form.lastName.trim(),
          middleName: mid === '' ? null : mid,
          studioIds,
          primaryStudioId: modal.form.primaryStudioId,
          specializations: specs,
          isActive: modal.form.isActive,
          serviceIds: modal.form.selectedServiceIds,
          categoryIds: modal.form.selectedCategoryIds,
        };
        if (modal.form.password.trim() !== '') {
          if (modal.form.password.length < 8) {
            setError('Пароль не короче 8 символов');
            setSaving(false);
            return;
          }
          patch.password = modal.form.password;
        }
        await apiRequest(`/admin/catalog/specialists/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      }
      setModal(null);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: SpecialistRow) {
    if (
      !globalThis.confirm(
        `Удалить специалиста «${row.lastName} ${row.firstName}»? Учётная запись и профиль будут удалены безвозвратно.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await apiRequest(`/admin/catalog/specialists/${row.id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  async function openShiftModal(row: SpecialistRow) {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const todayKey = shiftDateKey(now.toISOString());
    const studioOptions = row.specialistProfile.studios;
    const initialStudioId = row.primaryStudioId ?? studioOptions[0]?.id ?? '';
    setShiftModal({
      specialistId: row.id,
      specialistLabel: `${row.lastName} ${row.firstName}${row.middleName ? ` ${row.middleName}` : ''}`,
      activeTab: 'list',
      listStudioId: '',
      showCancelled: false,
      calendarAnchorDate: todayKey,
      selectedDate: todayKey,
      studioOptions,
      studioId: initialStudioId,
      startsAtLocal: toDatetimeLocalDefault(now),
      endsAtLocal: toDatetimeLocalDefault(end),
      bulkFromDate: toDateInputDefault(now),
      bulkToDate: toDateInputDefault(periodEnd),
      bulkWeekdays: [1, 2, 3, 4, 5],
      bulkStartTime: '10:00',
      bulkEndTime: '19:00',
      editingShiftId: null,
      rows: [],
      loading: true,
      saving: false,
      error: null,
    });
    try {
      const data = await apiRequest<ShiftRow[]>(`/admin/catalog/specialists/${row.id}/shifts`);
      setShiftModal((prev) => (prev ? { ...prev, rows: data, loading: false } : prev));
    } catch (e) {
      setShiftModal((prev) =>
        prev
          ? {
              ...prev,
              rows: [],
              loading: false,
              error: e instanceof ApiError ? e.message : 'Не удалось загрузить смены',
            }
          : prev,
      );
    }
  }

  async function addShift() {
    if (!shiftModal) return;
    if (!shiftModal.studioId) {
      setShiftModal({ ...shiftModal, error: 'Выберите студию' });
      return;
    }
    const startsAtLocal = shiftModal.startsAtLocal.trim();
    const endsAtLocal = shiftModal.endsAtLocal.trim();
    if (!startsAtLocal || !endsAtLocal) {
      setShiftModal({ ...shiftModal, error: 'Укажите дату и время начала и конца смены' });
      return;
    }
    if (new Date(endsAtLocal) <= new Date(startsAtLocal)) {
      setShiftModal({ ...shiftModal, error: 'Конец смены должен быть позже начала' });
      return;
    }

    setShiftModal({ ...shiftModal, saving: true, error: null });
    try {
      await apiRequest(`/admin/catalog/specialists/${shiftModal.specialistId}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId: shiftModal.studioId,
          startsAtLocal,
          endsAtLocal,
        }),
      });
      const rows = await apiRequest<ShiftRow[]>(`/admin/catalog/specialists/${shiftModal.specialistId}/shifts`);
      setShiftModal((prev) =>
        prev
          ? {
              ...prev,
              rows,
              saving: false,
              error: null,
            }
          : prev,
      );
    } catch (e) {
      setShiftModal((prev) =>
        prev
          ? {
              ...prev,
              saving: false,
              error: e instanceof ApiError ? e.message : 'Не удалось добавить смену',
            }
          : prev,
      );
    }
  }

  async function removeShift(shiftId: string) {
    if (!shiftModal) return;
    if (!globalThis.confirm('Отменить эту смену?')) return;
    setShiftModal({ ...shiftModal, error: null });
    try {
      await apiRequest(`/admin/catalog/specialists/${shiftModal.specialistId}/shifts/${shiftId}`, {
        method: 'DELETE',
      });
      const rows = await apiRequest<ShiftRow[]>(`/admin/catalog/specialists/${shiftModal.specialistId}/shifts`);
      setShiftModal((prev) => (prev ? { ...prev, rows } : prev));
    } catch (e) {
      setShiftModal((prev) =>
        prev ? { ...prev, error: e instanceof ApiError ? e.message : 'Не удалось отменить смену' } : prev,
      );
    }
  }

  async function startEditShift(row: ShiftRow) {
    if (!shiftModal) return;
    setShiftModal({
      ...shiftModal,
      activeTab: 'single',
      editingShiftId: row.id,
      studioId: row.studio.id,
      startsAtLocal: toDatetimeLocalDefault(new Date(row.startsAt)),
      endsAtLocal: toDatetimeLocalDefault(new Date(row.endsAt)),
      error: null,
    });
  }

  async function saveEditedShift() {
    if (!shiftModal) return;
    if (!shiftModal.editingShiftId) return;
    if (!shiftModal.studioId) {
      setShiftModal({ ...shiftModal, error: 'Выберите студию' });
      return;
    }
    const startsAtLocal = shiftModal.startsAtLocal.trim();
    const endsAtLocal = shiftModal.endsAtLocal.trim();
    if (!startsAtLocal || !endsAtLocal) {
      setShiftModal({ ...shiftModal, error: 'Укажите дату и время начала и конца смены' });
      return;
    }
    if (new Date(endsAtLocal) <= new Date(startsAtLocal)) {
      setShiftModal({ ...shiftModal, error: 'Конец смены должен быть позже начала' });
      return;
    }
    setShiftModal({ ...shiftModal, saving: true, error: null });
    try {
      await apiRequest(
        `/admin/catalog/specialists/${shiftModal.specialistId}/shifts/${shiftModal.editingShiftId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studioId: shiftModal.studioId,
            startsAtLocal,
            endsAtLocal,
          }),
        },
      );
      const rows = await apiRequest<ShiftRow[]>(
        `/admin/catalog/specialists/${shiftModal.specialistId}/shifts`,
      );
      setShiftModal((prev) =>
        prev
          ? {
              ...prev,
              rows,
              saving: false,
              editingShiftId: null,
              activeTab: 'list',
              error: null,
            }
          : prev,
      );
    } catch (e) {
      setShiftModal((prev) =>
        prev
          ? {
              ...prev,
              saving: false,
              error: e instanceof ApiError ? e.message : 'Не удалось сохранить смену',
            }
          : prev,
      );
    }
  }

  async function addBulkShifts() {
    if (!shiftModal) return;
    if (!shiftModal.studioId) {
      setShiftModal({ ...shiftModal, error: 'Выберите студию' });
      return;
    }
    if (shiftModal.bulkWeekdays.length === 0) {
      setShiftModal({ ...shiftModal, error: 'Выберите хотя бы один день недели' });
      return;
    }

    setShiftModal({ ...shiftModal, saving: true, error: null });
    try {
      const res = await apiRequest<{ createdCount: number; skippedCount: number }>(
        `/admin/catalog/specialists/${shiftModal.specialistId}/shifts/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studioId: shiftModal.studioId,
            fromDate: shiftModal.bulkFromDate,
            toDate: shiftModal.bulkToDate,
            weekdays: shiftModal.bulkWeekdays,
            startsAtLocal: shiftModal.bulkStartTime,
            endsAtLocal: shiftModal.bulkEndTime,
          }),
        },
      );
      const rows = await apiRequest<ShiftRow[]>(`/admin/catalog/specialists/${shiftModal.specialistId}/shifts`);
      setShiftModal((prev) =>
        prev
          ? {
              ...prev,
              rows,
              saving: false,
              error:
                res.skippedCount > 0
                  ? `Добавлено смен: ${res.createdCount}. Пропущено из-за пересечений: ${res.skippedCount}.`
                  : null,
            }
          : prev,
      );
    } catch (e) {
      setShiftModal((prev) =>
        prev
          ? {
              ...prev,
              saving: false,
              error: e instanceof ApiError ? e.message : 'Не удалось массово добавить смены',
            }
          : prev,
      );
    }
  }

  function applyBulkPreset(preset: 'weekdays' | 'everyday' | 'twoByTwo') {
    if (!shiftModal) return;
    if (preset === 'weekdays') {
      setShiftModal({
        ...shiftModal,
        bulkWeekdays: [1, 2, 3, 4, 5],
        bulkStartTime: '10:00',
        bulkEndTime: '19:00',
      });
      return;
    }
    if (preset === 'everyday') {
      setShiftModal({
        ...shiftModal,
        bulkWeekdays: [0, 1, 2, 3, 4, 5, 6],
        bulkStartTime: '10:00',
        bulkEndTime: '19:00',
      });
      return;
    }
    setShiftModal({
      ...shiftModal,
      bulkWeekdays: buildTwoByTwoWeekdays(shiftModal.bulkFromDate, shiftModal.bulkToDate),
      bulkStartTime: '10:00',
      bulkEndTime: '19:00',
    });
  }

  const studiosLabel = (r: SpecialistRow) =>
    r.specialistProfile.studios.map((s) => `${s.name} (${s.city})`).join(', ') || '—';

  const categoriesLabel = (r: SpecialistRow) => {
    const specialistCategories = r.specialistProfile.categoryIds
      .map((id) => categories.find((c) => c.id === id))
      .filter(Boolean);
    return specialistCategories.map((c) => c!.name).join(', ') || '—';
  };

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const fullName = `${r.lastName} ${r.firstName} ${r.middleName ?? ''}`;
      const studioText = studiosLabel(r);
      const specs = r.specialistProfile.specializations.join(', ');
      return (
        fullName.toLowerCase().includes(q) ||
        studioText.toLowerCase().includes(q) ||
        specs.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q)
      );
    });
  }, [rows, debouncedQuery]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let left = '';
      let right = '';
      if (sortField === 'categories') {
        left = categoriesLabel(a);
        right = categoriesLabel(b);
      } else if (sortField === 'fullName') {
        left = `${a.lastName} ${a.firstName} ${a.middleName ?? ''}`.trim();
        right = `${b.lastName} ${b.firstName} ${b.middleName ?? ''}`.trim();
      } else if (sortField === 'studios') {
        left = studiosLabel(a);
        right = studiosLabel(b);
      } else if (sortField === 'phone') {
        left = a.phone;
        right = b.phone;
      }
      const result = left.localeCompare(right, 'ru', { sensitivity: 'base' });
      return sortDirection === 'asc' ? result : -result;
    });
    return sorted;
  }, [filteredRows, sortField, sortDirection, categories]);

  function toggleSort(field: SpecialistSortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  }

  function sortMark(field: SpecialistSortField): string {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  const shiftStats = useMemo(() => {
    if (!shiftModal) return null;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    let upcoming = 0;
    let today = 0;
    let past = 0;
    let nearest: ShiftRow | null = null;

    for (const row of shiftModal.rows) {
      const startsAt = new Date(row.startsAt);
      const endsAt = new Date(row.endsAt);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) continue;

      if (endsAt >= todayStart) {
        upcoming += 1;
        if (nearest == null || new Date(nearest.startsAt) > startsAt) {
          nearest = row;
        }
      } else {
        past += 1;
      }

      if (startsAt >= todayStart && startsAt < todayEnd) {
        today += 1;
      }
    }

    return {
      total: shiftModal.rows.length,
      upcoming,
      today,
      past,
      nearest,
    };
  }, [shiftModal]);

  const studioFilteredShiftRows = useMemo(() => {
    if (!shiftModal) return [];
    return shiftModal.rows
      .filter((row) => (shiftModal.listStudioId ? row.studio.id === shiftModal.listStudioId : true))
      .filter((row) => (shiftModal.showCancelled ? true : row.status.trim().toLowerCase() !== 'cancelled'))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [shiftModal]);

  const dayCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of studioFilteredShiftRows) {
      const key = shiftDateKey(row.startsAt);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [studioFilteredShiftRows]);

  const calendarDays = useMemo(() => {
    if (!shiftModal) return [];
    const anchor = parseDateKey(shiftModal.calendarAnchorDate);
    const now = new Date();
    const todayKey = shiftDateKey(now.toISOString());
    const monthStart = startOfMonth(anchor);
    const gridStart = startOfWeekMonday(monthStart);
    const monthIndex = monthStart.getMonth();
    return Array.from({ length: 42 }).map((_, idx) => {
      const date = addDays(gridStart, idx);
      const key = shiftDateKey(date.toISOString());
      return {
        key,
        dayNum: date.getDate(),
        weekShort: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
        inRange: date.getMonth() === monthIndex,
        count: dayCountMap.get(key) ?? 0,
        isToday: key === todayKey,
      };
    });
  }, [shiftModal, dayCountMap]);

  const selectedDayRows = useMemo(() => {
    if (!shiftModal) return [];
    return studioFilteredShiftRows.filter((row) => shiftDateKey(row.startsAt) === shiftModal.selectedDate);
  }, [shiftModal, studioFilteredShiftRows]);

  const calendarMonthLabel = useMemo(() => {
    if (!shiftModal) return '';
    const anchor = parseDateKey(shiftModal.calendarAnchorDate);
    return anchor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }, [shiftModal]);

  useEffect(() => {
    if (!shiftModal) return;
    const hasSelected = studioFilteredShiftRows.some(
      (row) => shiftDateKey(row.startsAt) === shiftModal.selectedDate,
    );
    if (hasSelected) return;
    const fallback =
      studioFilteredShiftRows.length > 0
        ? shiftDateKey(studioFilteredShiftRows[0]!.startsAt)
        : shiftModal.calendarAnchorDate;
    if (fallback === shiftModal.selectedDate) return;
    setShiftModal((prev) => (prev ? { ...prev, selectedDate: fallback } : prev));
  }, [shiftModal, studioFilteredShiftRows]);

  useEffect(() => {
    const next = new URLSearchParams();
    const q = searchQuery.trim();
    const studio = studioFilterId.trim();
    if (q) next.set('q', q);
    if (studio) next.set('studio', studio);
    setSearchParams(next, { replace: true });
  }, [searchQuery, studioFilterId, setSearchParams]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            Специалисты
          </h1>
          {manage ? (
            <button
              type="button"
              className="primary"
              onClick={() => openCreate()}
              disabled={!studioAdmin && studios.length === 0}
            >
              Добавить
            </button>
          ) : null}
        </div>
        <p className="page-subtitle">
          Подологи, остеопаты, массажисты и др. Отметьте, в каких студиях сети ведётся приём; основная студия
          задаёт привязку учётной записи.
        </p>
      </div>

      <FilterBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onReset={() => {
          setSearchQuery('');
          setStudioFilterId('');
        }}
        resetDisabled={searchQuery.trim() === '' && studioFilterId.trim() === ''}
        foundCount={filteredRows.length}
        totalCount={rows.length}
        placeholder="Поиск..."
      >
        {canFilterByStudio ? (
          <div className="field" style={{ minWidth: 260, maxWidth: 380 }}>
            <label htmlFor="spec-filter-studio">Фильтр по студии</label>
            <select
              id="spec-filter-studio"
              value={studioFilterId}
              onChange={(ev) => setStudioFilterId(ev.target.value)}
            >
              <option value="">Все</option>
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </FilterBar>

      {!studioAdmin && studios.length === 0 && !loading ? (
        <p style={{ color: 'var(--muted)' }}>Сначала создайте студию на странице «Студии».</p>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap sticky-head">
          <table>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleSort('categories')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Направления <span>{sortMark('categories')}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleSort('fullName')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    ФИО <span>{sortMark('fullName')}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleSort('studios')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Студии <span>{sortMark('studios')}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleSort('phone')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Телефон <span>{sortMark('phone')}</span>
                  </button>
                </th>
                {manage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length > 0 ? (
                sortedRows.map((r) => {
                  const specialistCategories = r.specialistProfile.categoryIds
                    .map((id) => categories.find((c) => c.id === id))
                    .filter(Boolean);
                  return (
                    <tr key={r.id}>
                      <td>
                        {specialistCategories.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {specialistCategories.map((c) => (
                              <span
                                key={c!.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  fontSize: '0.85rem',
                                  backgroundColor: c!.color ? `${c!.color}20` : 'rgba(45,106,79,0.1)',
                                  color: c!.color || '#2D6A4F',
                                  border: `1px solid ${c!.color || '#2D6A4F'}40`,
                                }}
                              >
                                {c!.name}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {r.lastName} {r.firstName}
                        {r.middleName ? ` ${r.middleName}` : ''}
                      </td>
                      <td style={{ maxWidth: 280 }}>{studiosLabel(r)}</td>
                      <td className="mono">{r.phone}</td>
                      {manage ? (
                        <td>
                          <div className="table-action-row">
                          <button
                            type="button"
                            className="action-icon-btn"
                            aria-label="Открыть график"
                            title="График"
                            onClick={() => void openShiftModal(r)}
                          >
                            <ScheduleIcon />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn"
                            aria-label="Изменить специалиста"
                            title="Изменить"
                            onClick={() => openEdit(r)}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="danger action-icon-btn"
                            aria-label="Удалить специалиста"
                            title="Удалить"
                            onClick={() => void removeRow(r)}
                            disabled={r.id === user?.id}
                          >
                            <DeleteIcon />
                          </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={manage ? 5 : 4} style={{ color: 'var(--muted)' }}>
                    Ничего не найдено. Попробуйте изменить фильтры.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <div
            className="modal"
            style={{ width: 'min(560px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2>{modal.mode === 'create' ? 'Новый специалист' : 'Редактирование'}</h2>
            <form onSubmit={(ev) => void submitModal(ev)}>
              <div className="modal-scroll">
              <div className="field">
                <span>Студии</span>
                <div className="modal-checkbox-list">
                  {studios.map((s) => {
                    const checked = modal.form.selectedStudioIds.includes(s.id);
                    return (
                      <label key={s.id} className="modal-checkbox-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={studioAdmin}
                          onChange={(ev) =>
                            setModal(
                              setFormStudios(
                                modal,
                                toggleStudioId(modal.form.selectedStudioIds, s.id, ev.target.checked),
                              ),
                            )
                          }
                        />
                        {s.name} ({s.city})
                      </label>
                    );
                  })}
                </div>
                {studioAdmin ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
                    Администратор студии может добавлять специалистов только в свою точку.
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="spec-primary">Основная студия</label>
                <select
                  id="spec-primary"
                  value={modal.form.primaryStudioId}
                  onChange={(ev) =>
                    setModal({
                      ...modal,
                      form: { ...modal.form, primaryStudioId: ev.target.value },
                    })
                  }
                  required
                >
                  {modal.form.selectedStudioIds.length === 0 ? (
                    <option value="">— сначала выберите студии —</option>
                  ) : null}
                  {studios
                    .filter((s) => modal.form.selectedStudioIds.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="spec-specs">Специализации (через запятую)</label>
                <input
                  id="spec-specs"
                  placeholder="Подолог, остеопат, массажист…"
                  value={modal.form.specializationsText}
                  onChange={(ev) =>
                    setModal({
                      ...modal,
                      form: { ...modal.form, specializationsText: ev.target.value },
                    })
                  }
                />
              </div>

              <div className="field">
                <span>Услуги в выбранных студиях</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.25rem 0 0.35rem' }}>
                  Отметьте процедуры, которые мастер оказывает — они появятся при записи к нему в приложении.
                  Сначала создайте услуги на странице «Услуги».
                </p>
                <div className="modal-checkbox-list">
                  {modal.form.selectedStudioIds.length === 0 ? (
                    <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                      Сначала выберите студии выше.
                    </span>
                  ) : servicesForModal.length === 0 ? (
                    <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                      В этих студиях пока нет услуг — добавьте их в каталоге.
                    </span>
                  ) : (
                    servicesForModal.map((s) => {
                      const studio = studios.find((st) => st.id === s.studioId);
                      const suffix = studio ? ` — ${studio.name}` : '';
                      const checked = modal.form.selectedServiceIds.includes(s.id);
                      const inactive = !s.isActive;
                      return (
                        <label
                          key={s.id}
                          className="modal-checkbox-item"
                          style={{ opacity: inactive ? 0.55 : 1 }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(ev) =>
                              setModal({
                                ...modal,
                                form: {
                                  ...modal.form,
                                  selectedServiceIds: toggleServiceId(
                                    modal.form.selectedServiceIds,
                                    s.id,
                                    ev.target.checked,
                                  ),
                                },
                              })
                            }
                          />
                          <span>
                            {s.name}
                            {suffix}
                            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                              {' '}
                              ({s.durationMinutes} мин, {(s.priceMinor / 100).toLocaleString('ru-RU')} ₽)
                              {inactive ? ' — неактивна' : ''}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="field">
                <span>Направления деятельности</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.25rem 0 0.35rem' }}>
                  Отметьте направления, к которым относится специалист. Это удобнее, чем
                  отмечать каждую услугу отдельно. Сначала создайте направления в разделе «Направления».
                </p>
                <div className="modal-checkbox-list" style={{ maxHeight: 180 }}>
                  {categories.length === 0 ? (
                    <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                      Сначала создайте направления на странице «Направления».
                    </span>
                  ) : (
                    categories.map((c) => {
                      const checked = modal.form.selectedCategoryIds.includes(c.id);
                      return (
                        <label key={c.id} className="modal-checkbox-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(ev) =>
                              setModal({
                                ...modal,
                                form: {
                                  ...modal.form,
                                  selectedCategoryIds: toggleCategoryId(
                                    modal.form.selectedCategoryIds,
                                    c.id,
                                    ev.target.checked,
                                  ),
                                },
                              })
                            }
                          />
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {c.color ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 12,
                                  height: 12,
                                  borderRadius: 3,
                                  backgroundColor: c.color,
                                  border: '1px solid rgba(0,0,0,0.1)',
                                }}
                              />
                            ) : null}
                            {c.name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="field">
                <label htmlFor="spec-email">Email (вход в админку)</label>
                <input
                  id="spec-email"
                  type="email"
                  autoComplete="email"
                  value={modal.form.email}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, email: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="spec-pass">
                  Пароль {modal.mode === 'edit' ? '(оставьте пустым, чтобы не менять)' : ''}
                </label>
                <input
                  id="spec-pass"
                  type="password"
                  autoComplete={modal.mode === 'create' ? 'new-password' : 'current-password'}
                  value={modal.form.password}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, password: ev.target.value } })
                  }
                  required={modal.mode === 'create'}
                  minLength={modal.mode === 'create' ? 8 : undefined}
                />
              </div>

              <div className="field">
                <label htmlFor="spec-phone">Телефон</label>
                <input
                  id="spec-phone"
                  className="mono"
                  value={modal.form.phone}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, phone: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="spec-ln">Фамилия</label>
                <input
                  id="spec-ln"
                  value={modal.form.lastName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, lastName: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="spec-fn">Имя</label>
                <input
                  id="spec-fn"
                  value={modal.form.firstName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, firstName: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="spec-mn">Отчество</label>
                <input
                  id="spec-mn"
                  value={modal.form.middleName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, middleName: ev.target.value } })
                  }
                />
              </div>

              {modal.mode === 'edit' ? (
                <div className="field">
                  <label className="modal-toggle">
                    <input
                      type="checkbox"
                      checked={modal.form.isActive}
                      onChange={(ev) =>
                        setModal({
                          ...modal,
                          form: { ...modal.form, isActive: ev.target.checked },
                        })
                      }
                      disabled={modal.id === user?.id}
                    />{' '}
                    Активен
                  </label>
                </div>
              ) : null}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModal(null)}>
                  Отмена
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {shiftModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShiftModal(null)}>
          <div
            className="modal"
            style={{ width: 'min(940px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2>График специалиста</h2>
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>{shiftModal.specialistLabel}</p>

            <div className="shift-tabs">
              <button
                type="button"
                className={shiftModal.activeTab === 'list' ? 'primary' : undefined}
                onClick={() => setShiftModal({ ...shiftModal, activeTab: 'list' })}
              >
                Смены
              </button>
              <button
                type="button"
                className={shiftModal.activeTab === 'single' ? 'primary' : undefined}
                onClick={() => setShiftModal({ ...shiftModal, activeTab: 'single' })}
              >
                Добавить смену
              </button>
              <button
                type="button"
                className={shiftModal.activeTab === 'bulk' ? 'primary' : undefined}
                onClick={() => setShiftModal({ ...shiftModal, activeTab: 'bulk' })}
              >
                Шаблон
              </button>
            </div>

            <div className="shift-stat-grid">
              <div className="shift-stat-card">
                <span>Всего смен</span>
                <strong>{shiftStats?.total ?? 0}</strong>
              </div>
              <div className="shift-stat-card">
                <span>Сегодня</span>
                <strong>{shiftStats?.today ?? 0}</strong>
              </div>
              <div className="shift-stat-card">
                <span>Будущие</span>
                <strong>{shiftStats?.upcoming ?? 0}</strong>
              </div>
              <div className="shift-stat-card">
                <span>Ближайшая</span>
                <strong>
                  {shiftStats?.nearest ? new Date(shiftStats.nearest.startsAt).toLocaleString('ru-RU') : '—'}
                </strong>
              </div>
            </div>

            {shiftModal.activeTab === 'single' ? (
              <div className="shift-section-card">
                <p className="shift-helper-text">
                  {shiftModal.editingShiftId ? 'Редактирование смены.' : 'Быстрое добавление одной конкретной смены.'}
                </p>
                <div className="modal-grid-single-shift" style={{ marginBottom: 0 }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="shift-studio">Студия</label>
                    <select
                      id="shift-studio"
                      value={shiftModal.studioId}
                      onChange={(ev) => setShiftModal({ ...shiftModal, studioId: ev.target.value })}
                    >
                      {shiftModal.studioOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="shift-start">Начало</label>
                    <input
                      id="shift-start"
                      type="datetime-local"
                      value={shiftModal.startsAtLocal}
                      onChange={(ev) => setShiftModal({ ...shiftModal, startsAtLocal: ev.target.value })}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="shift-end">Конец</label>
                    <input
                      id="shift-end"
                      type="datetime-local"
                      value={shiftModal.endsAtLocal}
                      onChange={(ev) => setShiftModal({ ...shiftModal, endsAtLocal: ev.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => (shiftModal.editingShiftId ? void saveEditedShift() : void addShift())}
                    disabled={shiftModal.saving}
                  >
                    {shiftModal.saving
                      ? 'Сохранение…'
                      : shiftModal.editingShiftId
                        ? 'Сохранить'
                        : 'Добавить смену'}
                  </button>
                  {shiftModal.editingShiftId ? (
                    <button
                      type="button"
                      onClick={() =>
                        setShiftModal({
                          ...shiftModal,
                          editingShiftId: null,
                          activeTab: 'list',
                          error: null,
                        })
                      }
                      disabled={shiftModal.saving}
                    >
                      Отмена
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {shiftModal.activeTab === 'bulk' ? (
              <div className="shift-section-card">
                <strong>Шаблон на период</strong>
                <p className="shift-helper-text">Массово создаёт смены по выбранным дням недели и времени.</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => applyBulkPreset('weekdays')}>
                    Пн-Пт 10:00-19:00
                  </button>
                  <button type="button" onClick={() => applyBulkPreset('twoByTwo')}>
                    2/2 (по периоду)
                  </button>
                  <button type="button" onClick={() => applyBulkPreset('everyday')}>
                    Каждый день
                  </button>
                </div>
                <div className="modal-grid-bulk-shift">
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="shift-bulk-from">С даты</label>
                    <input
                      id="shift-bulk-from"
                      type="date"
                      value={shiftModal.bulkFromDate}
                      onChange={(ev) => setShiftModal({ ...shiftModal, bulkFromDate: ev.target.value })}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="shift-bulk-to">По дату</label>
                    <input
                      id="shift-bulk-to"
                      type="date"
                      value={shiftModal.bulkToDate}
                      onChange={(ev) => setShiftModal({ ...shiftModal, bulkToDate: ev.target.value })}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="shift-bulk-start">Начало</label>
                    <input
                      id="shift-bulk-start"
                      type="time"
                      value={shiftModal.bulkStartTime}
                      onChange={(ev) => setShiftModal({ ...shiftModal, bulkStartTime: ev.target.value })}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="shift-bulk-end">Конец</label>
                    <input
                      id="shift-bulk-end"
                      type="time"
                      value={shiftModal.bulkEndTime}
                      onChange={(ev) => setShiftModal({ ...shiftModal, bulkEndTime: ev.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void addBulkShifts()}
                    disabled={shiftModal.saving}
                  >
                    {shiftModal.saving ? 'Создание…' : 'Создать по шаблону'}
                  </button>
                </div>
                <div className="modal-weekdays">
                  {[
                    ['ВС', 0],
                    ['ПН', 1],
                    ['ВТ', 2],
                    ['СР', 3],
                    ['ЧТ', 4],
                    ['ПТ', 5],
                    ['СБ', 6],
                  ].map(([label, value]) => (
                    <label key={label} className="modal-weekday-chip">
                      <input
                        type="checkbox"
                        checked={shiftModal.bulkWeekdays.includes(value as number)}
                        onChange={(ev) => {
                          const n = value as number;
                          const next = ev.target.checked
                            ? [...new Set([...shiftModal.bulkWeekdays, n])]
                            : shiftModal.bulkWeekdays.filter((x) => x !== n);
                          setShiftModal({ ...shiftModal, bulkWeekdays: next });
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {shiftModal.error ? <div className="error-banner">{shiftModal.error}</div> : null}

            {shiftModal.activeTab !== 'list' ? null : shiftModal.loading ? (
              <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
            ) : shiftModal.rows.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>
                У специалиста пока нет смен. Добавьте хотя бы одну, чтобы в мобильном приложении появились
                доступные дата и время.
              </p>
            ) : (
              <div className="shift-section-card">
                <div className="shift-list-toolbar">
                  <div className="field" style={{ margin: 0, minWidth: 240 }}>
                    <label htmlFor="shift-list-studio">Студия</label>
                    <select
                      id="shift-list-studio"
                      value={shiftModal.listStudioId}
                      onChange={(ev) => setShiftModal({ ...shiftModal, listStudioId: ev.target.value })}
                    >
                      <option value="">Все студии</option>
                      {shiftModal.studioOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="modal-toggle" style={{ marginLeft: 'auto' }}>
                    <input
                      type="checkbox"
                      checked={shiftModal.showCancelled}
                      onChange={(ev) => setShiftModal({ ...shiftModal, showCancelled: ev.target.checked })}
                    />{' '}
                    Показывать отменённые
                  </label>
                  <span className="badge">Календарь: месяц</span>
                </div>

                {studioFilteredShiftRows.length === 0 ? (
                  <p style={{ color: 'var(--muted)', marginBottom: 0 }}>По выбранной студии смен не найдено.</p>
                ) : (
                  <div className="shift-calendar-layout">
                    <div className="shift-calendar-controls">
                      <button
                        type="button"
                        onClick={() =>
                          setShiftModal({
                            ...shiftModal,
                            calendarAnchorDate: shiftDateKey(
                              addMonths(parseDateKey(shiftModal.calendarAnchorDate), -1).toISOString(),
                            ),
                          })
                        }
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const todayKey = shiftDateKey(now.toISOString());
                          setShiftModal({ ...shiftModal, calendarAnchorDate: todayKey, selectedDate: todayKey });
                        }}
                      >
                        Сегодня
                      </button>
                      <strong className="shift-calendar-title">{calendarMonthLabel}</strong>
                      <button
                        type="button"
                        onClick={() =>
                          setShiftModal({
                            ...shiftModal,
                            calendarAnchorDate: shiftDateKey(
                              addMonths(parseDateKey(shiftModal.calendarAnchorDate), 1).toISOString(),
                            ),
                          })
                        }
                      >
                        →
                      </button>
                    </div>
                    <div className="shift-calendar-grid month">
                      {calendarDays.map((day) => (
                        <button
                          key={day.key}
                          type="button"
                          className={`shift-calendar-cell${day.inRange ? '' : ' muted'}${
                            day.key === shiftModal.selectedDate ? ' active' : ''
                          }${day.isToday ? ' today' : ''}`}
                          onClick={() =>
                            setShiftModal({
                              ...shiftModal,
                              selectedDate: day.key,
                              calendarAnchorDate: day.key,
                            })
                          }
                        >
                          <span>{day.weekShort}</span>
                          <strong>{day.dayNum}</strong>
                          <em>{day.count > 0 ? `${day.count} смен` : '—'}</em>
                        </button>
                      ))}
                    </div>
                    <div className="shift-calendar-day-panel">
                      <h3>{shiftDateLabel(shiftModal.selectedDate)}</h3>
                      {selectedDayRows.length === 0 ? (
                        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>На выбранный день смен нет.</p>
                      ) : (
                        <div className="shift-cards">
                          {selectedDayRows.map((r) => (
                            <article key={r.id} className="shift-card-item">
                              <div className="shift-card-main">
                                <div className="shift-card-time">
                                  {shiftTimeLabel(r.startsAt)} - {shiftTimeLabel(r.endsAt)}
                                </div>
                                <div className="shift-card-studio">
                                  {r.studio.name} ({r.studio.city})
                                </div>
                              </div>
                              <div className="shift-card-meta">
                                <span
                                  className={`badge${
                                    shiftStatusTone(r.status) === 'muted'
                                      ? ''
                                      : shiftStatusTone(r.status) === 'danger'
                                        ? ' danger'
                                        : shiftStatusTone(r.status) === 'warn'
                                          ? ' warn'
                                          : ' success'
                                  }`}
                                >
                                  {shiftStatusLabel(r.status)}
                                </span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    className="action-icon-btn"
                                    aria-label="Изменить смену"
                                    title="Изменить"
                                    onClick={() => void startEditShift(r)}
                                  >
                                    <EditIcon />
                                  </button>
                                  <button type="button" className="danger" onClick={() => void removeShift(r.id)}>
                                    Отменить
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={() => setShiftModal(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
