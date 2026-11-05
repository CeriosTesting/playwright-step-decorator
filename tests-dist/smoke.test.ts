import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

// Types come from the source so that linting doesn't need a build. The tests themselves only load `dist`.
type Package = typeof import("../src");
type RecordedStep = { location?: { file: string }; title: string };

const distPath = (file: string) => resolve(__dirname, "..", "dist", file);
const loadCjs = (): Package => createRequire(__filename)(distPath("index.cjs")) as Package;
const loadEsm = (): Promise<Package> => import(pathToFileURL(distPath("index.mjs")).href) as Promise<Package>;

const builds: Array<[string, () => Package | Promise<Package>]> = [
	["CommonJS", loadCjs],
	["ES module", loadEsm],
];

// Records each call and still runs the real `test.step`, so these tests exercise real Playwright steps.
const recordedSteps: RecordedStep[] = [];
const realStep = test.step;
test.beforeEach(() => {
	recordedSteps.length = 0;
	const recordingStep = (title: string, body: never, options?: { location?: { file: string } }) => {
		recordedSteps.push({ title, location: options?.location });
		return (realStep as (...args: unknown[]) => unknown)(title, body, options);
	};
	(test as unknown as { step: unknown }).step = recordingStep;
});
test.afterEach(() => {
	(test as unknown as { step: unknown }).step = realStep;
});

for (const [name, load] of builds) {
	test.describe(`${name} build`, () => {
		test("reports a step with the formatted title and the caller's location", async () => {
			const { step } = await load();
			class Page {
				@step("Login as {{user.name}} ([[1]], __role__)", { values: { role: (_user, role) => role.toUpperCase() } })
				async login(user: { name: string }, role: string): Promise<string> {
					void role;
					return user.name;
				}
			}

			await expect(new Page().login({ name: "Alice" }, "admin")).resolves.toBe("Alice");

			expect(recordedSteps).toHaveLength(1);
			expect(recordedSteps[0].title).toBe("Login as Alice (admin, ADMIN)");
			expect(recordedSteps[0].location?.file).toMatch(/smoke\.test\.ts$/u);
		});

		test("provides step info inside a decorated method and resolves stepResult", async () => {
			const { getStepInfo, step, stepResult } = await load();
			class Page {
				@step("Attach")
				async attach(): Promise<void> {
					await getStepInfo().attach("note", { body: "text", contentType: "text/plain" });
				}

				@step("Build")
				build(): Promise<string> {
					return stepResult("built");
				}
			}

			await new Page().attach();
			await expect(new Page().build()).resolves.toBe("built");
			expect(() => getStepInfo()).toThrow("No Playwright step context found");
		});

		test("removes the package's own frames from errors thrown inside a step", async () => {
			const { step } = await load();
			class Page {
				@step("Fail")
				async fail(): Promise<void> {
					throw new Error("boom");
				}
			}

			const error = (await new Page().fail().catch((e: unknown) => e)) as Error;
			expect(error.message).toBe("boom");
			expect(error.stack).toContain("smoke.test.ts");
			expect(error.stack).not.toMatch(/dist[/\\]index\.(?:cjs|mjs)/u);
		});

		test("throws at class definition for a broken placeholder", async () => {
			const { step } = await load();
			expect(() => {
				class Page {
					@step("Value {{missing}}")
					async open(): Promise<void> {}
				}
				void Page;
			}).toThrow("Missing function parameters (missing) in method 'open'");
		});
	});
}

test("shares the step context between the CommonJS and ES module builds", async () => {
	const cjs = loadCjs();
	const esm = await loadEsm();
	expect(cjs.step).not.toBe(esm.step);

	class FromCjs {
		@cjs.step("Started by CommonJS")
		async run(): Promise<boolean> {
			return esm.getStepInfo() !== undefined;
		}
	}
	class FromEsm {
		@esm.step("Started by ES module")
		async run(): Promise<boolean> {
			return cjs.getStepInfo() !== undefined;
		}
	}

	await expect(new FromCjs().run()).resolves.toBe(true);
	await expect(new FromEsm().run()).resolves.toBe(true);
});
