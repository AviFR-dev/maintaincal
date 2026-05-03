export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function dueBadge(nextDueAt: string | null) {
  if (!nextDueAt) return { label: 'No due date', cls: 'border-zinc-800 text-zinc-300' };
  const ms = new Date(nextDueAt).getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, cls: 'border-red-900/60 bg-red-950/30 text-red-200' };
  if (days <= 30) return { label: `Due in ${days}d`, cls: 'border-amber-900/60 bg-amber-950/30 text-amber-200' };
  return { label: `Due in ${days}d`, cls: 'border-emerald-900/60 bg-emerald-950/30 text-emerald-200' };
}

/**
 * Escape HTML special characters to prevent XSS attacks.
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Safe component for displaying user content
 */
export function SafeText({ text }: { text: string | null | undefined }) {
  return <span>{escapeHtml(text)}</span>;
}

