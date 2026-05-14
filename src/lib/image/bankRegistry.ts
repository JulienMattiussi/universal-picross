/**
 * Registre des banques de templates apprises et packagées dans le code.
 *
 * Pour ajouter une nouvelle banque :
 * 1. Charger l'image dans la page benchmark, fournir le ground truth, lancer l'apprentissage
 * 2. Cliquer "Exporter en .ts" — récupérer le fichier généré
 * 3. Le placer dans `bankPacks/<nom>.ts`
 * 4. Ajouter une entrée dans `LEARNED_BANK_LOADERS` ci-dessous
 */

import type { BankCandidate, LearnedTemplate } from '@/lib/image/learnedBank'
import { getFreePicrossBank } from '@/lib/image/bankPacks/freePicross'

const LEARNED_BANK_LOADERS: { name: string; load: () => Promise<LearnedTemplate[]> }[] = [
  { name: 'freePicross', load: getFreePicrossBank },
]

let cachedBanks: BankCandidate[] | null = null

/**
 * Retourne toutes les banques apprises packagées dans le code, chargées en mémoire.
 * Mises en cache après le premier appel.
 */
export async function getAvailableLearnedBanks(): Promise<BankCandidate[]> {
  if (cachedBanks) return cachedBanks
  cachedBanks = await Promise.all(
    LEARNED_BANK_LOADERS.map(async ({ name, load }) => ({
      name,
      bank: await load(),
    })),
  )
  return cachedBanks
}
