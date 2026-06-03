import test, { expect } from "@playwright/test";

import { getStepInfo, step, stepResult } from "../src";

import { MenuPom } from "./pages/menu-page";

const createDeferred = <T = void>() => {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>(resolver => {
		resolve = resolver;
	});
	return { promise, resolve };
};

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

test("keeps step context isolated for concurrent calls on the same instance", async () => {
	const ready = createDeferred<void>();
	const release = createDeferred<void>();
	let started = 0;
	let recorded = 0;
	const observations: Array<{ label: string; before: object; after: object }> = [];

	const observeStepContext = async (label: string, getCurrentStep: () => object) => {
		const before = getCurrentStep();

		started += 1;
		if (started === 2) {
			ready.resolve();
		}
		await ready.promise;

		const after = getCurrentStep();
		observations.push({ label, before, after });

		recorded += 1;
		if (recorded === 2) {
			release.resolve();
		}
		await release.promise;
	};

	class ConcurrentSteps {
		@step("Async method")
		async asyncMethod(): Promise<void> {
			await observeStepContext("async", () => getStepInfo(this));
		}

		@step("Promise-returning method")
		promiseMethod(): Promise<void> {
			return stepResult(() => observeStepContext("promise", () => getStepInfo()));
		}
	}

	const instance = new ConcurrentSteps();
	await Promise.all([instance.asyncMethod(), instance.promiseMethod()]);

	const asyncObservation = observations.find(observation => observation.label === "async");
	const promiseObservation = observations.find(observation => observation.label === "promise");

	expect(asyncObservation).toBeDefined();
	expect(promiseObservation).toBeDefined();

	if (!asyncObservation || !promiseObservation) {
		throw new Error("Expected both concurrent step observations to be recorded.");
	}

	expect(asyncObservation.before).toBe(asyncObservation.after);
	expect(promiseObservation.before).toBe(promiseObservation.after);
	expect(asyncObservation.before).not.toBe(promiseObservation.before);
});
