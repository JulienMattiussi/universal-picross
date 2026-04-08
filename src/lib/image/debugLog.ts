/**
 * Système de log structuré pour le pipeline de traitement d'image.
 * Activé uniquement en mode debug (Ctrl+D).
 *
 * Format :
 *   [phase] étape ..................... résultat
 *
 * Les phases sont numérotées dans l'ordre du pipeline :
 *   1. BOUNDS  — détection automatique des bornes
 *   2. EXPAND  — expansion des coins cliqués
 *   3. EXTRACT — extraction et découpe des cases
 */

type LogFn = (...args: unknown[]) => void

const STYLES = {
  phase: 'color: #f97316; font-weight: bold',
  ok: 'color: #16a34a; font-weight: bold',
  fail: 'color: #ef4444; font-weight: bold',
  info: 'color: #6b7280',
  data: 'color: #3b82f6',
} as const

function pad(label: string, width = 30): string {
  return label.padEnd(width, ' ')
}

export function createDebugLogger(phase: string, enabled: boolean): LogFn {
  if (!enabled) return () => {}
  return (...args: unknown[]) => {
    console.log(`%c[${phase}]`, STYLES.phase, ...args)
  }
}

export function logStep(log: LogFn, step: string, result: string, success?: boolean): void {
  const style = success === false ? STYLES.fail : success === true ? STYLES.ok : STYLES.info
  log(`%c${pad(step)}%c${result}`, STYLES.info, style)
}

export function logData(log: LogFn, label: string, data: unknown): void {
  log(`%c${pad(label)}%c→`, STYLES.info, STYLES.data, data)
}

export function logSeparator(log: LogFn, title: string): void {
  log(`%c── ${title} ${'─'.repeat(Math.max(0, 40 - title.length))}`, STYLES.info)
}
