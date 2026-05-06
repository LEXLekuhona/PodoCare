import type { ReactNode } from 'react';

interface FilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onReset: () => void;
  resetDisabled: boolean;
  foundCount: number;
  totalCount: number;
  placeholder?: string;
  children?: ReactNode;
}

export function FilterBar({
  query,
  onQueryChange,
  onReset,
  resetDisabled,
  foundCount,
  totalCount,
  placeholder = 'Поиск',
  children,
}: FilterBarProps) {
  return (
    <div className="surface-card filters-card">
      {children}
      <div className="field" style={{ minWidth: 260, maxWidth: 360 }}>
        <label htmlFor="list-search">Поиск</label>
        <input
          id="list-search"
          placeholder={placeholder}
          value={query}
          onChange={(ev) => onQueryChange(ev.target.value)}
        />
      </div>
      <button type="button" onClick={onReset} disabled={resetDisabled}>
        Сбросить
      </button>
      <span className="badge">
        Найдено: {foundCount}/{totalCount}
      </span>
    </div>
  );
}
