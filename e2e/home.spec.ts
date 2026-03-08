import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("displays the app name and tool cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "1two.dev" })).toBeVisible();
    await expect(page.getByText("JWT Parser")).toBeVisible();
    await expect(page.getByText("JSON Tool")).toBeVisible();
    await expect(page.getByText("Base64 Encoder/Decoder")).toBeVisible();
  });

  test("navigates to a tool when clicking a card", async ({ page }) => {
    await page.goto("/");
    await page.getByText("JWT Parser").click();
    await expect(page).toHaveURL("/tools/jwt");
  });

  test("opens launcher with Ctrl+P", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+p");
    await expect(page.getByPlaceholder("Search tools...")).toBeVisible();
  });

  test("launcher searches and navigates", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+p");
    await page.getByPlaceholder("Search tools...").fill("base64");
    await expect(page.getByRole("option", { name: /Base64 Encoder/ })).toBeVisible();
    await page.getByRole("option", { name: /Base64 Encoder/ }).click();
    await expect(page).toHaveURL("/tools/b64");
  });
});
