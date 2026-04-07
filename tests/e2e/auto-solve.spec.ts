import { test, expect } from '@playwright/test'

test.describe('Solveur automatique', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Générer' }).click()
    await expect(page.getByRole('grid')).toBeVisible()
  })

  test('le bouton Résoudre est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Résoudre' })).toBeVisible()
  })

  test('résout le puzzle et affiche "Résolu !"', async ({ page }) => {
    await page.getByRole('button', { name: 'Résoudre' }).click()
    // Attendre la fin de la résolution (max 10s pour les grands puzzles)
    await expect(page.getByText('Résolu !')).toBeVisible({ timeout: 10000 })
  })
})
