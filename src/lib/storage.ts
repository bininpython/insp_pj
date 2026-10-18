import type { Worker } from '../types';

const KEY = 'equipe-inspecao-pj-v2';
const LEGACY_KEY = 'equipe-inspecao-pj-v1';

export function loadWorkers(): Worker[] {
  try {
    const saved = localStorage.getItem(KEY);
    const parsed: unknown = JSON.parse(saved ?? localStorage.getItem(LEGACY_KEY) ?? '[]');
    const workers = Array.isArray(parsed) ? parsed as Worker[] : [];
    if (!saved && workers.length) localStorage.setItem(KEY, JSON.stringify(workers));
    localStorage.removeItem('equipe-inspecao-session-v1');
    return workers;
  } catch {
    return [];
  }
}

export function saveWorkers(workers: Worker[]) {
  localStorage.setItem(KEY, JSON.stringify(workers));
}

export function downloadFile(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}
