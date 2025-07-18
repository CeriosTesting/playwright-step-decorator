import test, { expect } from "@playwright/test";
import { MenuPom } from "./pages/menu-page";

test("Happy flow", async ({ page }) => {
	const menuPage = new MenuPom(page);

	const action = async () => {
		await page.goto("https://playwright.dev/");
		await Promise.all([
			menuPage.assertNavbarItems(["Docs", "API", "Node.js", "Community"]),
			menuPage.attachAdditionalInfo(),
			menuPage.attachScreenshot(),
		]);
	};

	await expect(action()).resolves.not.toThrow();
});
