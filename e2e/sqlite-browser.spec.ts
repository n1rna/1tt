import { test, expect } from "@playwright/test";
import path from "path";

const DB_PATH = path.join(__dirname, "fixtures", "Car_Database.db");

test.describe("SQLite Browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/sqlite");
  });

  test("loads database and shows tables", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(DB_PATH);

    // Should show table list — Customers is one of the tables
    await expect(page.getByText("Customers")).toBeVisible({ timeout: 10000 });
  });

  test("displays table data when a table is selected", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(DB_PATH);

    await page.getByText("Customers").click();

    // Should show column headers
    await expect(page.getByText("first_name")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("household_income")).toBeVisible();

    // Should show actual data
    await expect(page.getByRole("cell", { name: "Jeremy", exact: true })).toBeVisible();
  });

  test("filter on text column works", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(DB_PATH);

    await page.getByText("Customers").click();
    await expect(page.getByText("first_name")).toBeVisible({ timeout: 5000 });

    // Open filter row
    await page.getByRole("button", { name: /Filter/ }).click();

    // Type a valid filter into the first_name filter
    const filterInputs = page.locator('thead input[type="text"]');
    // first_name is the second column (after customer_id)
    await filterInputs.nth(1).fill("Jeremy");

    // Should still show Jeremy in the data rows
    await expect(page.locator("tbody").getByText("Jeremy", { exact: true })).toBeVisible({ timeout: 5000 });
    // Other names should not be visible
    await expect(page.locator("tbody").getByText("Maria")).not.toBeVisible();
  });

  test("filter with non-matching string on numeric column keeps table visible", async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(DB_PATH);

    await page.getByText("Customers").click();
    await expect(page.getByText("first_name")).toBeVisible({ timeout: 5000 });

    // Open filter row
    await page.getByRole("button", { name: /Filter/ }).click();

    // household_income is the 5th column (index 4) — type a non-numeric string
    const filterInputs = page.locator('thead input[type="text"]');
    await filterInputs.nth(4).fill("abc");

    // Table headers must still be visible (this is the bug — they used to disappear)
    await expect(page.getByText("first_name")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("household_income")).toBeVisible();

    // Filter inputs should still be visible so user can correct the filter
    await expect(filterInputs.first()).toBeVisible();

    // Clear the filter — table should recover and show data again
    await filterInputs.nth(4).fill("");
    await expect(page.getByRole("cell", { name: "Jeremy", exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("switching tables after a bad filter works correctly", async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(DB_PATH);

    await page.getByText("Customers").click();
    await expect(page.getByText("first_name")).toBeVisible({ timeout: 5000 });

    // Open filter and enter non-matching value on numeric column
    await page.getByRole("button", { name: /Filter/ }).click();
    const filterInputs = page.locator('thead input[type="text"]');
    await filterInputs.nth(4).fill("xyz");

    // Headers should still be visible
    await expect(page.getByText("first_name")).toBeVisible({ timeout: 5000 });

    // Switch to another table — should work fine
    await page.getByText("Brands").click();
    await expect(page.getByText("brand_name")).toBeVisible({ timeout: 5000 });
  });
});
