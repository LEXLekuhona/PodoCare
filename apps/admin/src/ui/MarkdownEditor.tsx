import { useCallback, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  ariaLabel?: string;
}

interface InlineWrap {
  prefix: string;
  suffix: string;
  fallback: string;
}

interface LinePrefixCommand {
  prefix: string;
}

/**
 * Простой Markdown-редактор для админки: тулбар с кнопками базового форматирования + опциональное превью.
 *
 * Решения:
 * - Используем неизменяемый workflow: правки идут через `onChange(next)` родителя, не мутируем DOM напрямую.
 * - После каждого insert переустанавливаем selection через requestAnimationFrame, чтобы не конфликтовать с
 *   рендером React (он перерисует textarea и собьёт selection до коммита).
 * - Превью включается опционально и работает в режиме split (textarea слева, рендер справа).
 *   `react-markdown` по умолчанию НЕ рендерит raw HTML, что нам и нужно — тело хранится как Markdown.
 */
export function MarkdownEditor({ id, value, onChange, rows = 8, placeholder, ariaLabel }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const applyInlineWrap = useCallback(
    (cmd: InlineWrap) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.slice(0, start);
      const selected = value.slice(start, end) || cmd.fallback;
      const after = value.slice(end);
      const next = before + cmd.prefix + selected + cmd.suffix + after;
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const cursorEnd = before.length + cmd.prefix.length + selected.length;
        ta.setSelectionRange(cursorEnd, cursorEnd);
      });
    },
    [value, onChange],
  );

  const applyLinePrefix = useCallback(
    (cmd: LinePrefixCommand) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = value.indexOf('\n', end);
      const safeEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const block = value.slice(lineStart, safeEnd);
      const replaced = block
        .split('\n')
        .map((line) => cmd.prefix + line)
        .join('\n');
      const next = value.slice(0, lineStart) + replaced + value.slice(safeEnd);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const cursor = lineStart + replaced.length;
        ta.setSelectionRange(cursor, cursor);
      });
    },
    [value, onChange],
  );

  const insertLink = useCallback(() => {
    const url = window.prompt('Введите URL ссылки:', 'https://');
    if (url == null) return;
    const trimmed = url.trim();
    if (trimmed === '') return;
    applyInlineWrap({ prefix: '[', suffix: `](${trimmed})`, fallback: 'текст' });
  }, [applyInlineWrap]);

  return (
    <div className="md-editor">
      <div className="md-toolbar" role="toolbar" aria-label="Форматирование Markdown">
        <button type="button" onClick={() => applyLinePrefix({ prefix: '# ' })} title="Заголовок 1">
          H1
        </button>
        <button type="button" onClick={() => applyLinePrefix({ prefix: '## ' })} title="Заголовок 2">
          H2
        </button>
        <button
          type="button"
          onClick={() => applyInlineWrap({ prefix: '**', suffix: '**', fallback: 'жирный' })}
          title="Жирный"
        >
          <strong>Ж</strong>
        </button>
        <button
          type="button"
          onClick={() => applyInlineWrap({ prefix: '*', suffix: '*', fallback: 'курсив' })}
          title="Курсив"
        >
          <em>К</em>
        </button>
        <button type="button" onClick={() => applyLinePrefix({ prefix: '- ' })} title="Маркированный список">
          Список
        </button>
        <button type="button" onClick={() => applyLinePrefix({ prefix: '> ' })} title="Цитата">
          Цитата
        </button>
        <button type="button" onClick={insertLink} title="Вставить ссылку">
          Ссылка
        </button>
        <span className="md-toolbar__spacer" aria-hidden />
        <button
          type="button"
          aria-pressed={showPreview}
          onClick={() => setShowPreview((v) => !v)}
          className={showPreview ? 'primary' : undefined}
        >
          {showPreview ? 'Скрыть превью' : 'Превью'}
        </button>
      </div>

      <div className={showPreview ? 'md-body md-body--split' : 'md-body'}>
        <textarea
          id={id}
          ref={textareaRef}
          rows={rows}
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
        />
        {showPreview ? (
          <div className="md-preview" aria-label="Превью Markdown">
            {value.trim() ? (
              <ReactMarkdown>{value}</ReactMarkdown>
            ) : (
              <p className="md-preview__empty">Превью появится после ввода текста.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
