import type { Worker } from '../types';

const KEY = 'equipe-inspecao-pj-v2';

export function loadWorkers(): Worker[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed as Worker[] : [];
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
