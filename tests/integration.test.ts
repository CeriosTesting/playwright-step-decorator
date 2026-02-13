import test, { expect } from "@playwright/test";
import { getStepLocation, step } from "../src/playwright-step-decorator";
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

test("Verify the callsite is captured correctly", async () => {
	class ReportStepExample {
		@step("Array values: [[0]]")
		async format(arr: string[]) {
			const location = getStepLocation(this);
			expect(location.file).toContain("integration.test.ts");
			expect(arr).toEqual(["one", "two", "three"]);
			return `Value is ${arr.join(",")}`;
		}
	}

	const instance = new ReportStepExample();
	await instance.format(["one", "two", "three"]);
});
