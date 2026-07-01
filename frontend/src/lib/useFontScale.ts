/**
 * useFontScale — controla o tamanho da fonte global via classes no <html>.
 * Persiste a escolha no localStorage.
 */
import { useState, useEffect } from 'react';

export type FontScale = 'font-sm' | 'font-md' | 'font-lg' | 'font-xl';

const LEVELS: FontScale[] = ['font-sm', 'font-md', 'font-lg', 'font-xl'];
const LABELS: Record<FontScale, string> = {
  'font-sm': 'P',
  'font-md': 'M',
  'font-lg': 'G',
  'font-xl': 'XG',
};
const STORAGE_KEY = 'monitor-ia:font-scale';
const DEFAULT: FontScale = 'font-md';

function applyScale(scale: FontScale) {
  const html = document.documentElement;
  LEVELS.forEach(l => html.classList.remove(l));
  html.classList.add(scale);
}

export function useFontScale() {
  const [scale, setScale] = useState<FontScale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as FontScale | null;
    return saved && LEVELS.includes(saved) ? saved : DEFAULT;
  });

  // Aplicar na montagem inicial
  useEffect(() => {
    applyScale(scale);
  }, [scale]);

  function increase() {
    setScale(current => {
      const idx = LEVELS.indexOf(current);
      const next = LEVELS[Math.min(idx + 1, LEVELS.length - 1)];
      localStorage.setItem(STORAGE_KEY, next);
      applyScale(next);
      return next;
    });
  }

  function decrease() {
    setScale(current => {
      const idx = LEVELS.indexOf(current);
      const next = LEVELS[Math.max(idx - 1, 0)];
      localStorage.setItem(STORAGE_KEY, next);
      applyScale(next);
      return next;
    });
  }

  const canIncrease = scale !== LEVELS[LEVELS.length - 1];
  const canDecrease = scale !== LEVELS[0];

  return { scale, label: LABELS[scale], increase, decrease, canIncrease, canDecrease };
}
