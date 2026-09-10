import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const PASSWORD = 'password123';

async function register(page: Page, name: string, email: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('button', { name: 'Crear sala' })).toBeVisible();
}

async function buildFleet(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Explorador/ }).click();
  await page.getByRole('button', { name: /Submarino/ }).click();
  await page.getByRole('button', { name: /Taller naval/ }).click();
  await page.getByRole('button', { name: 'Al azar' }).click();
  await page.getByRole('button', { name: 'Flota preparada' }).click();
}

test('shows the room code before the opponent joins', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await register(page, 'Solo', `solo-${Date.now()}@e2e.test`);

  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(page.getByTestId('room-code')).toBeVisible();
  await expect(page.getByText('Esperando al rival…')).toBeVisible();

  await context.close();
});

test('two players create a room, join and start a match', async ({ browser }) => {
  const stamp = Date.now();
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await register(host, 'Host', `host-${stamp}@e2e.test`);
  await register(guest, 'Guest', `guest-${stamp}@e2e.test`);

  await host.getByRole('button', { name: 'Crear sala' }).click();
  const code = (await host.getByTestId('room-code').textContent())?.trim();
  expect(code).toBeTruthy();

  await guest.getByPlaceholder('CÓDIGO').fill(code ?? '');
  await guest.getByRole('button', { name: 'Entrar' }).click();

  await buildFleet(host);
  await buildFleet(guest);

  await expect(host.getByText('Tu turno')).toBeVisible();
  await expect(guest.getByText('Turno del rival')).toBeVisible();

  // Host fires at A1 (no ship there) and ends the turn.
  await host.getByTestId('ship-scout').click();
  await host.getByRole('button', { name: 'Apuntar' }).click();
  await host
    .getByRole('region', { name: 'Aguas rivales' })
    .getByTitle('A1', { exact: true })
    .click();
  await host.getByRole('button', { name: 'Confirmar · 1 acción' }).click();
  await host.getByRole('button', { name: 'Terminar turno' }).click();

  await expect(guest.getByText('Tu turno')).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});
