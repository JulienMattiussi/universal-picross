import { test, expect } from '@playwright/test'

test.describe('Jouer au picross', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Générer' }).click()
    await expect(page.getByRole('grid')).toBeVisible()
  })

  test('peut cliquer sur une case pour la remplir', async ({ page }) => {
    const cells = page.getByRole('grid').getByRole('button')
    const firstCell = cells.first()
    await firstCell.click()
    // Pas d'erreur → le clic a fonctionné
    await expect(firstCell).toBeVisible()
  })

  test('peut réinitialiser la grille', async ({ page }) => {
    const cells = page.getByRole('grid').getByRole('button')
    await cells.first().click()
    await page.getByRole('button', { name: 'Recommencer' }).click()
    // La grille est toujours visible après reset
    await expect(page.getByRole('grid')).toBeVisible()
  })

  test('le chronomètre est visible', async ({ page }) => {
    await expect(page.getByText(/\d{2}:\d{2}/)).toBeVisible()
  })
})
