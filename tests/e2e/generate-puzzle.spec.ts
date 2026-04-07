import { test, expect } from '@playwright/test'

test.describe('Générateur de puzzle', () => {
  test('génère un nouveau puzzle et affiche la grille', async ({ page }) => {
    await page.goto('/')

    // Le générateur est visible
    await expect(page.getByText('Nouveau puzzle')).toBeVisible()

    // Clic sur Générer
    await page.getByRole('button', { name: 'Générer' }).click()

    // La grille de jeu apparaît
    await expect(page.getByRole('grid')).toBeVisible()
  })

  test('change la taille du puzzle via le slider', async ({ page }) => {
    await page.goto('/')

    const slider = page.getByRole('slider')
    await slider.fill('8')
    await page.getByRole('button', { name: 'Générer' }).click()

    await expect(page.getByRole('grid')).toBeVisible()
  })

  test('change la difficulté et génère', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Difficile' }).click()
    await page.getByRole('button', { name: 'Générer' }).click()

    await expect(page.getByRole('grid')).toBeVisible()
  })
})
