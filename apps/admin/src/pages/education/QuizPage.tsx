import { ContentCtaTarget } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import { DeleteIcon } from '../../ui/DeleteIcon';
import EditIcon from '../../ui/EditIcon';
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

type OptionForm = { text: string; scoreDelta: string; tagsCsv: string };
type QuestionForm = { text: string; type: string; options: OptionForm[] };
type OutcomeForm = {
  segment: string;
  title: string;
  description: string;
  minScore: string;
  maxScore: string;
  sortOrder: string;
  primaryCtaLabel: string;
  primaryCtaTarget: string;
  recommendedIdsCsv: string;
};

const QUESTION_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO'] as const;

const CTA_TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Не задано' },
  ...Object.values(ContentCtaTarget).map((v) => ({ value: v, label: v })),
];

function tagsFromCsv(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function csvFromTags(tags: string[] | undefined): string {
  return (tags ?? []).join(', ');
}

function defaultQuestionForm(): QuestionForm {
  return {
    text: '',
    type: 'SINGLE_CHOICE',
    options: [
      { text: 'Вариант 1', scoreDelta: '1', tagsCsv: '' },
      { text: 'Вариант 2', scoreDelta: '0', tagsCsv: '' },
    ],
  };
}

function defaultOutcomeForm(): OutcomeForm {
  return {
    segment: 'LOW',
    title: '',
    description: '',
    minScore: '0',
    maxScore: '2',
    sortOrder: '0',
    primaryCtaLabel: '',
    primaryCtaTarget: '',
    recommendedIdsCsv: '',
  };
}

function dtoToQuestionForms(rows: QuizQuestion[]): QuestionForm[] {
  if (rows.length === 0) return [defaultQuestionForm()];
  return rows.map((q) => ({
    text: q.text,
    type: q.type ?? 'SINGLE_CHOICE',
    options:
      q.options.length > 0
        ? q.options.map((o) => ({
            text: o.text,
            scoreDelta: String(o.scoreDelta),
            tagsCsv: csvFromTags(o.tags),
          }))
        : [{ text: '', scoreDelta: '0', tagsCsv: '' }],
  }));
}

function dtoToOutcomeForms(rows: QuizOutcome[]): OutcomeForm[] {
  if (rows.length === 0) return [defaultOutcomeForm()];
  return rows.map((o) => ({
    segment: o.segment,
    title: o.title,
    description: o.description,
    minScore: String(o.minScore),
    maxScore: String(o.maxScore),
    sortOrder: String(o.sortOrder),
    primaryCtaLabel: o.primaryCtaLabel ?? '',
    primaryCtaTarget: o.primaryCtaTarget ?? '',
    recommendedIdsCsv: (o.recommendedContentIds ?? []).join(', '),
  }));
}

function formsToPayload(questions: QuestionForm[], outcomes: OutcomeForm[]): {
  questions: QuizQuestion[];
  outcomes: QuizOutcome[];
} {
  const qPayload: QuizQuestion[] = questions.map((q, qi) => ({
    text: q.text.trim(),
    order: qi,
    type: q.type,
    options: q.options.map((o) => ({
      text: o.text.trim(),
      scoreDelta: Number(o.scoreDelta) || 0,
      tags: tagsFromCsv(o.tagsCsv),
    })),
  }));
  const oPayload: QuizOutcome[] = outcomes.map((o) => ({
    segment: o.segment.trim(),
    title: o.title.trim(),
    description: o.description.trim(),
    minScore: Number(o.minScore) || 0,
    maxScore: Number(o.maxScore) || 0,
    sortOrder: Number(o.sortOrder) || 0,
    primaryCtaLabel: o.primaryCtaLabel.trim() || undefined,
    primaryCtaTarget: o.primaryCtaTarget.trim() || undefined,
    recommendedContentIds: o.recommendedIdsCsv
      .split(',')
      .map((s) => s.trim())
      .filter((x) => /^[0-9a-f-]{36}$/i.test(x)),
  }));
  return { questions: qPayload, outcomes: oPayload };
}

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
  const [questions, setQuestions] = useState<QuestionForm[]>([defaultQuestionForm()]);
  const [outcomes, setOutcomes] = useState<OutcomeForm[]>([defaultOutcomeForm()]);

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
    setQuestions(dtoToQuestionForms(quiz.questions));
    setOutcomes(dtoToOutcomeForms(quiz.outcomes));
  }

  function resetForm() {
    setEditId(null);
    setNetworkId('');
    setSlug('');
    setTitle('');
    setDescription('');
    setIsPublished(false);
    setQuestions([defaultQuestionForm()]);
    setOutcomes([defaultOutcomeForm()]);
  }

  function validateForm(): boolean {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      if (!q.text.trim()) {
        setError(`Вопрос ${i + 1}: укажите текст`);
        return false;
      }
      if (q.options.length === 0) {
        setError(`Вопрос ${i + 1}: добавьте хотя бы один вариант`);
        return false;
      }
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j]!;
        if (!opt.text.trim()) {
          setError(`Вопрос ${i + 1}, вариант ${j + 1}: укажите текст ответа`);
          return false;
        }
      }
    }
    for (let i = 0; i < outcomes.length; i++) {
      const o = outcomes[i]!;
      if (!o.segment.trim() || !o.title.trim() || !o.description.trim()) {
        setError(`Исход ${i + 1}: заполните сегмент, заголовок и описание`);
        return false;
      }
    }
    return true;
  }

  async function submit() {
    if (!canSubmit || saving) return;
    if (!validateForm()) {
      showToast('Проверьте поля формы', 'error');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { questions: qJson, outcomes: oJson } = formsToPayload(questions, outcomes);
      const payload = {
        networkId: networkId.trim(),
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        isPublished,
        questions: qJson,
        outcomes: oJson,
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
        <p className="page-subtitle">Редактор: вопросы, варианты, исходы (outcomes), публикация.</p>
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
          <input type="checkbox" checked={isPublished} onChange={(ev) => setIsPublished(ev.target.checked)} /> Опубликован
        </label>

        <h3 style={{ marginTop: 20, marginBottom: 8 }}>Вопросы</h3>
        {questions.map((q, qi) => (
          <div key={`q-${qi}`} className="card" style={{ padding: 12, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong>Вопрос {qi + 1}</strong>
              {questions.length > 1 ? (
                <button
                  type="button"
                  className="danger action-icon-btn"
                  aria-label="Удалить вопрос"
                  title="Удалить"
                  onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                >
                  <DeleteIcon />
                </button>
              ) : null}
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              <span>Текст</span>
              <input value={q.text} onChange={(ev) => setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, text: ev.target.value } : x)))} />
            </label>
            <label className="field">
              <span>Тип</span>
              <select
                value={q.type}
                onChange={(ev) => setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, type: ev.target.value } : x)))}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                </option>
                ))}
              </select>
            </label>
            <div style={{ marginTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Варианты</span>
              {q.options.map((o, oi) => (
                <div key={`q-${qi}-o-${oi}`} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
                  <label className="field">
                    <span>Текст</span>
                    <input
                      value={o.text}
                      onChange={(ev) =>
                        setQuestions((prev) =>
                          prev.map((qq, i) =>
                            i !== qi
                              ? qq
                              : {
                                  ...qq,
                                  options: qq.options.map((oo, j) => (j === oi ? { ...oo, text: ev.target.value } : oo)),
                                },
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Вес</span>
                    <input
                      type="number"
                      value={o.scoreDelta}
                      onChange={(ev) =>
                        setQuestions((prev) =>
                          prev.map((qq, i) =>
                            i !== qi
                              ? qq
                              : {
                                  ...qq,
                                  options: qq.options.map((oo, j) =>
                                    j === oi ? { ...oo, scoreDelta: ev.target.value } : oo,
                                  ),
                                },
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Теги (через запятую)</span>
                    <input
                      value={o.tagsCsv}
                      onChange={(ev) =>
                        setQuestions((prev) =>
                          prev.map((qq, i) =>
                            i !== qi
                              ? qq
                              : {
                                  ...qq,
                                  options: qq.options.map((oo, j) =>
                                    j === oi ? { ...oo, tagsCsv: ev.target.value } : oo,
                                  ),
                                },
                          ),
                        )
                      }
                    />
                  </label>
                  {q.options.length > 1 ? (
                    <button
                      type="button"
                      className="danger action-icon-btn"
                      aria-label="Удалить вариант"
                      title="Удалить"
                      onClick={() =>
                        setQuestions((prev) =>
                          prev.map((qq, i) =>
                            i !== qi ? qq : { ...qq, options: qq.options.filter((_, j) => j !== oi) },
                          ),
                        )
                      }
                    >
                      <DeleteIcon />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              <button
                type="button"
                style={{ marginTop: 8 }}
                onClick={() =>
                  setQuestions((prev) =>
                    prev.map((qq, i) =>
                      i !== qi ? qq : { ...qq, options: [...qq.options, { text: '', scoreDelta: '0', tagsCsv: '' }] },
                    ),
                  )
                }
              >
                + Вариант
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setQuestions((prev) => [...prev, defaultQuestionForm()])}>
          + Вопрос
        </button>

        <h3 style={{ marginTop: 24, marginBottom: 8 }}>Исходы (outcomes)</h3>
        {outcomes.map((o, oi) => (
          <div key={`o-${oi}`} className="card" style={{ padding: 12, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Исход {oi + 1}</strong>
              {outcomes.length > 1 ? (
                <button
                  type="button"
                  className="danger action-icon-btn"
                  aria-label="Удалить исход"
                  title="Удалить"
                  onClick={() => setOutcomes((prev) => prev.filter((_, i) => i !== oi))}
                >
                  <DeleteIcon />
                </button>
              ) : null}
            </div>
            <div className="grid-two" style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
              <label className="field">
                <span>Сегмент (LOW / MEDIUM / HIGH / CRITICAL)</span>
                <select
                  value={o.segment}
                  onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, segment: ev.target.value } : x)))}
                >
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Порядок (sortOrder)</span>
                <input
                  type="number"
                  value={o.sortOrder}
                  onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, sortOrder: ev.target.value } : x)))}
                />
              </label>
              <label className="field">
                <span>Заголовок</span>
                <input value={o.title} onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, title: ev.target.value } : x)))} />
              </label>
              <label className="field">
                <span>minScore</span>
                <input
                  type="number"
                  value={o.minScore}
                  onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, minScore: ev.target.value } : x)))}
                />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Описание</span>
                <textarea
                  rows={2}
                  value={o.description}
                  onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, description: ev.target.value } : x)))}
                />
              </label>
              <label className="field">
                <span>maxScore</span>
                <input
                  type="number"
                  value={o.maxScore}
                  onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, maxScore: ev.target.value } : x)))}
                />
              </label>
              <label className="field">
                <span>CTA target</span>
                <select
                  value={o.primaryCtaTarget}
                  onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, primaryCtaTarget: ev.target.value } : x)))}
                >
                  {CTA_TARGET_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>CTA label</span>
                <input
                  value={o.primaryCtaLabel}
                  onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, primaryCtaLabel: ev.target.value } : x)))}
                />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Рекомендованные серии контента (UUID через запятую)</span>
                <input
                  value={o.recommendedIdsCsv}
                  onChange={(ev) => setOutcomes((prev) => prev.map((x, i) => (i === oi ? { ...x, recommendedIdsCsv: ev.target.value } : x)))}
                  placeholder="uuid1, uuid2"
                />
              </label>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setOutcomes((prev) => [...prev, defaultOutcomeForm()])}>
          + Исход
        </button>

        <div className="toolbar" style={{ marginTop: 16 }}>
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
                    <button
                      type="button"
                      className="action-icon-btn"
                      aria-label="Редактировать квиз"
                      title="Редактировать"
                      onClick={() => applyQuizToForm(row)}
                    >
                      <EditIcon />
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
