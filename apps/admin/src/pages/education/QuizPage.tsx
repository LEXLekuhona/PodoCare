import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import { useToast } from '../../ui/ToastContext';

type QuizOption = { text: string; scoreDelta: number; tags?: string[] };
type QuizQuestion = { text: string; order: number; type?: string; options: QuizOption[] };
type QuizOutcome = {
  segment: string;
  title: string;
  description: string;
  minScore: number;
  maxScore: number;
  sortOrder: number;
  primaryCtaLabel?: string;
  primaryCtaTarget?: string;
  recommendedContentIds?: string[];
};

type QuizAdminDto = {
  id: string;
  networkId: string;
  slug: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  questions: QuizQuestion[];
  outcomes: QuizOutcome[];
};

const DEFAULT_QUESTIONS_JSON = JSON.stringify(
  [
    {
      text: 'Как часто вы испытываете дискомфорт?',
      order: 0,
      type: 'SINGLE_CHOICE',
      options: [
        { text: 'Редко', scoreDelta: 1, tags: ['low_risk'] },
        { text: 'Иногда', scoreDelta: 2, tags: ['medium_risk'] },
        { text: 'Часто', scoreDelta: 4, tags: ['high_risk'] },
      ],
    },
  ],
  null,
  2,
);

const DEFAULT_OUTCOMES_JSON = JSON.stringify(
  [
    {
      segment: 'LOW',
      title: 'Профилактический режим',
      description: 'Рекомендуем поддерживающий контент и базовый уход.',
      minScore: 0,
      maxScore: 2,
      sortOrder: 0,
      primaryCtaLabel: 'Смотреть рекомендации',
      primaryCtaTarget: 'CONTENT_SERIES',
    },
    {
      segment: 'HIGH',
      title: 'Нужна консультация',
      description: 'Есть признаки, с которыми лучше обратиться к специалисту.',
      minScore: 3,
      maxScore: 10,
      sortOrder: 1,
      primaryCtaLabel: 'Записаться на консультацию',
      primaryCtaTarget: 'SERVICE',
    },
  ],
  null,
  2,
);

export function QuizPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<QuizAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [networkId, setNetworkId] = useState('');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [questionsJson, setQuestionsJson] = useState(DEFAULT_QUESTIONS_JSON);
  const [outcomesJson, setOutcomesJson] = useState(DEFAULT_OUTCOMES_JSON);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiRequest<QuizAdminDto[]>('/quiz/admin');
      setRows(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки квизов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canSubmit = useMemo(
    () => networkId.trim() !== '' && slug.trim() !== '' && title.trim() !== '',
    [networkId, slug, title],
  );

  function applyQuizToForm(quiz: QuizAdminDto) {
    setEditId(quiz.id);
    setNetworkId(quiz.networkId);
    setSlug(quiz.slug);
    setTitle(quiz.title);
    setDescription(quiz.description ?? '');
    setIsPublished(quiz.isPublished);
    setQuestionsJson(JSON.stringify(quiz.questions, null, 2));
    setOutcomesJson(JSON.stringify(quiz.outcomes, null, 2));
  }

  function resetForm() {
    setEditId(null);
    setNetworkId('');
    setSlug('');
    setTitle('');
    setDescription('');
    setIsPublished(false);
    setQuestionsJson(DEFAULT_QUESTIONS_JSON);
    setOutcomesJson(DEFAULT_OUTCOMES_JSON);
  }

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const questions = JSON.parse(questionsJson) as QuizQuestion[];
      const outcomes = JSON.parse(outcomesJson) as QuizOutcome[];

      const payload = {
        networkId: networkId.trim(),
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        isPublished,
        questions,
        outcomes,
      };

      if (editId) {
        await apiRequest(`/quiz/admin/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/quiz/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      await reload();
      showToast(editId ? 'Квиз обновлён' : 'Квиз создан', 'success');
      if (!editId) resetForm();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить квиз');
      showToast('Ошибка сохранения квиза', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Диагностический квиз</h1>
        <p className="page-subtitle">
          Базовый редактор квиза: вопросы, веса, сегменты результата и CTA.
        </p>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="card" style={{ padding: 16 }}>
        <div className="grid-two" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <label className="field">
            <span>Network ID</span>
            <input value={networkId} onChange={(ev) => setNetworkId(ev.target.value)} placeholder="UUID сети" />
          </label>
          <label className="field">
            <span>Slug</span>
            <input value={slug} onChange={(ev) => setSlug(ev.target.value)} placeholder="diagnostic-quiz" />
          </label>
          <label className="field">
            <span>Заголовок</span>
            <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Диагностический квиз" />
          </label>
          <label className="field">
            <span>Описание</span>
            <input value={description} onChange={(ev) => setDescription(ev.target.value)} />
          </label>
        </div>

        <label className="field" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(ev) => setIsPublished(ev.target.checked)}
          />{' '}
          Опубликован
        </label>

        <label className="field" style={{ marginTop: 12 }}>
          <span>Questions JSON</span>
          <textarea rows={12} className="mono" value={questionsJson} onChange={(ev) => setQuestionsJson(ev.target.value)} />
        </label>

        <label className="field" style={{ marginTop: 12 }}>
          <span>Outcomes JSON</span>
          <textarea rows={12} className="mono" value={outcomesJson} onChange={(ev) => setOutcomesJson(ev.target.value)} />
        </label>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <button type="button" className="primary" disabled={!canSubmit || saving} onClick={() => void submit()}>
            {saving ? 'Сохранение...' : editId ? 'Обновить квиз' : 'Создать квиз'}
          </button>
          {editId ? (
            <button type="button" onClick={resetForm}>
              Сбросить редактирование
            </button>
          ) : null}
        </div>
      </div>

      <div className="table-wrap sticky-head" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>slug</th>
              <th>Опубликован</th>
              <th>Вопросов</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Загрузка...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>Пока нет квизов</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td className="mono">{row.slug}</td>
                  <td>{row.isPublished ? 'да' : 'нет'}</td>
                  <td>{row.questions.length}</td>
                  <td>
                    <button type="button" onClick={() => applyQuizToForm(row)}>
                      Редактировать
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
