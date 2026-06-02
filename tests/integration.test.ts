import test, { expect } from "@playwright/test";

import { MenuPom } from "./pages/menu-page";

test("Happy flow - sync method", async ({ page }) => {
	const menuPage = new MenuPom(page);

	await page.goto("https://playwright.dev/");
	menuPage.getPageTitle();

	expect(page.url()).toContain("playwright.dev");
});

test("Happy flow", async ({ page }) => {
	const menuPage = new MenuPom(page);

	const action = async () => {
		await page.goto("https://playwright.dev/");
		await Promise.all([
			menuPage.assertNavbarItems(["Docs", "MCP", "CLI", "API", "Node.js"]),
			menuPage.attachAdditionalInfo(),
			menuPage.attachScreenshot(),
		]);
	};

	await expect(action()).resolves.not.toThrow();
});
