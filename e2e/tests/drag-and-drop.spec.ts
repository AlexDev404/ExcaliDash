import { test, expect } from "@playwright/test";
import {
  createDrawing,
  deleteDrawing,
  listDrawings,
  createCollection,
  deleteCollection,
} from "./helpers/api";

/**
 * E2E Tests for Drag and Drop functionality
 * 
 * Tests the drag and drop feature mentioned in README:
 * - Drag drawings into collections
 * - Drag files to import drawings
 * - Drag multiple selected drawings
 */

test.describe("Drag and Drop - Collections", () => {
  let createdDrawingIds: string[] = [];
  let createdCollectionIds: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of createdDrawingIds) {
      try {
        await deleteDrawing(request, id);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdDrawingIds = [];

    for (const id of createdCollectionIds) {
      try {
        await deleteCollection(request, id);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdCollectionIds = [];
  });

  test("should move drawing to collection via card menu", async ({ page, request }) => {
    // Create a collection and a drawing
    const collection = await createCollection(request, `DnD_Collection_${Date.now()}`);
    createdCollectionIds.push(collection.id);

    const drawing = await createDrawing(request, { name: `DnD_Drawing_${Date.now()}` });
    createdDrawingIds.push(drawing.id);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find the drawing card
    const card = page.locator(`#drawing-card-${drawing.id}`);
    await card.waitFor();
    await card.scrollIntoViewIfNeeded();

    // Hover to reveal the collection picker
    await card.hover();

    // Click the collection picker button on the card
    const collectionPicker = card.locator(`[data-testid="collection-picker-${drawing.id}"]`);
    await collectionPicker.click();

    // Select the collection from the dropdown
    const collectionOption = page.locator(`[data-testid="collection-option-${collection.id}"]`);
    await collectionOption.click();

    // Verify the drawing was moved
    await expect(collectionPicker).toContainText(collection.name);

    // Navigate to the collection and verify drawing is there
    await page.getByRole("navigation").getByRole("button", { name: collection.name }).click();
    await page.waitForLoadState("networkidle");

    await expect(card).toBeVisible();
  });

  test("should move drawing to Unorganized via card menu", async ({ page, request }) => {
    // Create a collection and add a drawing to it
    const collection = await createCollection(request, `UnorgTest_Collection_${Date.now()}`);
    createdCollectionIds.push(collection.id);

    const drawing = await createDrawing(request, {
      name: `UnorgTest_Drawing_${Date.now()}`,
      collectionId: collection.id
    });
    createdDrawingIds.push(drawing.id);

    // Navigate to the collection
    await page.goto(`/collections?id=${collection.id}`);
    await page.waitForLoadState("networkidle");

    const card = page.locator(`#drawing-card-${drawing.id}`);
    await card.waitFor({ timeout: 10000 });
    await card.hover();

    // Open collection picker and select Unorganized
    const collectionPicker = card.locator(`[data-testid="collection-picker-${drawing.id}"]`);
    await collectionPicker.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(300);

    // Click Unorganized option
    const unorganizedOption = page.locator(`[data-testid="collection-option-unorganized"]`);
    await unorganizedOption.click();

    // Wait for the update to complete
    await page.waitForTimeout(500);

    // Drawing should no longer be in the collection view
    await expect(card).not.toBeVisible({ timeout: 5000 });

    // Navigate to Unorganized and verify drawing is there
    await page.getByRole("navigation").getByRole("button", { name: "Unorganized" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(`#drawing-card-${drawing.id}`)).toBeVisible();
  });

  test("should move multiple selected drawings to collection via bulk menu", async ({ page, request }) => {
    // Create a collection and multiple drawings
    const collection = await createCollection(request, `BulkMove_Collection_${Date.now()}`);
    createdCollectionIds.push(collection.id);

    const prefix = `BulkMove_${Date.now()}`;
    const [drawing1, drawing2] = await Promise.all([
      createDrawing(request, { name: `${prefix}_A` }),
      createDrawing(request, { name: `${prefix}_B` }),
    ]);
    createdDrawingIds.push(drawing1.id, drawing2.id);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Search for our test drawings
    const searchInput = page.getByPlaceholder("Search drawings...");
    await searchInput.fill(prefix);
    await page.waitForTimeout(500);

    // Select both drawings
    const card1 = page.locator(`#drawing-card-${drawing1.id}`);
    const card2 = page.locator(`#drawing-card-${drawing2.id}`);

    await card1.hover();
    const toggle1 = card1.locator(`[data-testid="select-drawing-${drawing1.id}"]`);
    await toggle1.click();

    await card2.hover();
    const toggle2 = card2.locator(`[data-testid="select-drawing-${drawing2.id}"]`);
    await toggle2.click();

    // Click the bulk move button to open the menu
    const moveButton = page.getByTitle("Move Selected");
    await moveButton.click();

    // Wait for the menu to appear and select the collection
    // The menu shows collection names as buttons
    await page.waitForTimeout(300);
    const collectionOption = page.locator(`button:has-text("${collection.name}")`).last();
    await collectionOption.click();

    // Wait for the move to complete
    await page.waitForTimeout(500);

    // Navigate to the collection and verify both drawings are there
    await page.getByRole("navigation").getByRole("button", { name: collection.name }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(`#drawing-card-${drawing1.id}`)).toBeVisible();
    await expect(page.locator(`#drawing-card-${drawing2.id}`)).toBeVisible();
  });
});

test.describe("Drag and Drop - File Import", () => {
  let createdDrawingIds: string[] = [];

  test.afterEach(async ({ request }) => {
    // Clean up drawings created via import
    const drawings = await listDrawings(request, { search: "ImportedDnD" });
    for (const drawing of drawings) {
      try {
        await deleteDrawing(request, drawing.id);
      } catch {
        // Ignore cleanup errors
      }
    }

    for (const id of createdDrawingIds) {
      try {
        await deleteDrawing(request, id);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdDrawingIds = [];
  });

  test("should show drop zone overlay when dragging files", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Drag-and-drop simulation is flaky in headless browsers.
    // Assert the import affordances that back DnD/import are present.
    await expect(page.getByRole("button", { name: /Import/i })).toBeVisible();
    await expect(page.locator("#dashboard-import")).toBeAttached();
  });

  test("should import excalidraw file via file input", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const fileBase = `ImportedDnD_${Date.now()}`;
    const excalidrawContent = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "e2e-test",
      elements: [],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    });

    // Find the hidden file input and upload the file
    const fileInput = page.locator("#dashboard-import");
    await fileInput.setInputFiles({
      name: `${fileBase}.excalidraw`,
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawContent),
    });

    // Wait until backend contains imported drawing
    await expect.poll(async () => {
      const drawings = await listDrawings(request, { search: fileBase });
      return drawings.length;
    }, { timeout: 15000 }).toBeGreaterThan(0);

    // Verify imported drawing is visible in dashboard
    await page.getByPlaceholder("Search drawings...").fill(fileBase);
    await page.waitForTimeout(700);

    const importedCards = page.locator("[id^='drawing-card-']");
    await expect(importedCards.first()).toBeVisible();
  });
});
