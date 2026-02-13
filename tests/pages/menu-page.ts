import { expect, Locator, Page } from "@playwright/test";
import { step, getStepInfo } from "../../src";

export class MenuPom {
	private readonly parent: Locator = this._page.getByLabel("Main");
	private readonly menuLeft: Locator = this.parent.locator(".theme-layout-navbar-left");
	private readonly navbarItem: Locator = this.menuLeft.locator(".navbar__item");

	constructor(private readonly _page: Page) {}

	@step("Assert the navbar items are as expected")
	async assertNavbarItems(expectedItems: string[]): Promise<void> {
		const stepInfo = getStepInfo(this);
		await stepInfo.attach("expected-items.json", {
			body: JSON.stringify(expectedItems),
			contentType: "application/json",
		});
		await expect(this.navbarItem).toHaveText(expectedItems, { useInnerText: true });
		await stepInfo.attach("actual-items.json", {
			body: JSON.stringify(await this.navbarItem.allInnerTexts()),
			contentType: "application/json",
		});
	}

	@step("Attachment 2")
	async attachAdditionalInfo(): Promise<void> {
		await getStepInfo(this).attach("additional-info.json", {
			body: JSON.stringify({ info: "Some additional information" }),
			contentType: "application/json",
		});
	}

	@step("Attach a screenshot")
	async attachScreenshot(): Promise<void> {
		await getStepInfo(this).attach("screenshot.png", {
			body: await this._page.screenshot(),
			contentType: "image/png",
		});
	}
}
