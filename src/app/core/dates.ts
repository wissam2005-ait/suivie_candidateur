export function aujourdhui(): string {
  return toIso(new Date());
}

export function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

export function ajouterJours(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** Nombre de jours entre deux dates ISO (b - a). */
export function ecartJours(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round((db - da) / 86_400_000);
}

export function formatCourt(iso: string): string {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
