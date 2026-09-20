import { expect, test } from "@playwright/test";

test("loads the Friendenza holder journey", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Friendenza/);
  await expect(page.getByRole("heading", { name: "Make your friend flow." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "connect to begin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "generate yours" })).toBeVisible();

  await page.getByRole("link", { name: "generate yours" }).click();
  await expect(page.locator("#generate")).toBeInViewport();
});
