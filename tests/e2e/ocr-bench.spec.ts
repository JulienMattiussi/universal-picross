import { test, expect, devices } from '@playwright/test'

// Le benchmark OCR utilise des chips de mode debug visibles uniquement en viewport desktop.
test.use({ ...devices['Desktop Chrome'] })

/**
 * Garde-fou contre toute régression OCR sur Free Picross.
 *
 * Pipeline testé : extractGridCells → segmentBlobs → matching banque générique
 * → apprentissage depuis ground truth → matching banque apprise. Si la banque
 * packagée `freePicross.ts` ou n'importe quelle brique d'image se casse, ce
 * test pète.
 */
test.describe('OCR — banque apprise Free Picross', () => {
  test('reconnaît > 95% des chiffres de la fixture 2-C', async ({ page }) => {
    // Le runner du bench appelle Tesseract pour CHAQUE blob (~5s/case en headless).
    // Sur 30 cases × ~2 blobs, on peut atteindre 4-5 minutes. CI ne tournera pas
    // ce test souvent — la durée est acceptable.
    test.setTimeout(400_000)

    // Force la locale française : le test cible des labels FR ('Valider la sélection',
    // 'Apprendre la banque…') et la locale par défaut sous Chromium headless est en-US.
    await page.addInitScript(() => {
      localStorage.setItem('picross-locale', 'fr')
    })
    await page.goto('/')

    // Active le mode debug via dispatch direct du keydown (Ctrl+D peut être
    // intercepté par le navigateur sur certains environnements headless).
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'd' }))
    })

    await page.getByRole('button', { name: 'ocr-bench' }).click()
    await expect(page.getByText('Benchmark OCR')).toBeVisible()
    await expect(page.getByText('Free Picross — Level 2-C')).toBeVisible()

    // Valide les coins par défaut → lance le benchmark complet
    await page.getByRole('button', { name: 'Valider la sélection' }).click()

    // Tesseract + matching générique sur 30 cellules — long en headless
    await expect(page.getByText('Résultats globaux')).toBeVisible({ timeout: 300_000 })

    // Déclenche l'apprentissage + ré-évaluation
    await page.getByRole('button', { name: /Apprendre la banque/ }).click()

    await expect(page.getByText(/Banque apprise \(\d+ templates extraits\)/)).toBeVisible({
      timeout: 60_000,
    })
    // L'évaluation par la banque apprise prend du temps : 74 templates × 74 blobs.
    // Les stats "Apprise — XXX" n'apparaissent qu'à la fin.
    await expect(page.getByText('Apprise — IoU')).toBeVisible({ timeout: 180_000 })
    await expect(page.getByText('Apprise — Hausdorff')).toBeVisible()

    // Extrait le ratio "chiffres reconnus / total" pour chaque méthode apprise.
    // Format attendu dans MethodStat : "Apprise — XXX\nCases : N/M (%)\nChiffres : N/M (%)"
    const mainText = await page.locator('main').innerText()

    const iouMatch = mainText.match(/Apprise — IoU[\s\S]*?Chiffres\s*:\s*(\d+)\/(\d+)/)
    const hausMatch = mainText.match(/Apprise — Hausdorff[\s\S]*?Chiffres\s*:\s*(\d+)\/(\d+)/)

    expect(iouMatch, 'stats Apprise — IoU introuvables').not.toBeNull()
    expect(hausMatch, 'stats Apprise — Hausdorff introuvables').not.toBeNull()

    const iouRatio = parseInt(iouMatch![1], 10) / parseInt(iouMatch![2], 10)
    const hausRatio = parseInt(hausMatch![1], 10) / parseInt(hausMatch![2], 10)

    expect(iouRatio, `IoU appris: ${iouMatch![1]}/${iouMatch![2]}`).toBeGreaterThanOrEqual(0.95)
    expect(hausRatio, `Hausdorff appris: ${hausMatch![1]}/${hausMatch![2]}`).toBeGreaterThanOrEqual(
      0.95,
    )
  })
})
