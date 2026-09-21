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

test("uses pixel typography and persists dark mode", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() =>
      page
        .getByRole("heading", { name: "Make your friend flow." })
        .evaluate((element) => getComputedStyle(element).fontFamily),
    )
    .toContain("Silkscreen");

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
