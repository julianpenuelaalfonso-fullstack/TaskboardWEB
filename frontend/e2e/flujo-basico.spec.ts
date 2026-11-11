import { expect, test } from "@playwright/test";

test("registrarse, crear tablero, agregar y completar tarea, cerrar y volver a entrar", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "contraseña-segura-1";

  await page.goto("/registro");
  await page.getByLabel("Nombre").fill("Ana E2E");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await page.getByRole("button", { name: "+ Tablero" }).click();
  await page.getByRole("dialog").getByLabel("Nombre").fill("Mi tablero");
  await page.getByRole("dialog").getByRole("button", { name: "Crear tablero" }).click();

  await page.getByPlaceholder("¿Qué hay que hacer?").fill("Primera tarea");
  await page.getByRole("button", { name: "Agregar tarea" }).click();
  await page.getByRole("checkbox").click();
  await expect(page.getByRole("heading", { name: /Hechas/ })).toBeVisible();

  await page.getByText("Ana E2E").click(); // abre el menú de usuario
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await page.getByRole("link", { name: "Mi tablero" }).first().click();
  const hechas = page.getByRole("region", { name: /Hechas/ });
  await expect(hechas.getByText("Primera tarea")).toBeVisible();
});
