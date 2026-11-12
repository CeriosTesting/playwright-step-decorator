import { getStepInfo, step, stepResult } from "@cerios/playwright-step-decorator";
import type { StepOptions, StepValues, ValuePlaceholderKeys } from "@cerios/playwright-step-decorator";
import type { Location, TestStepInfo } from "@playwright/test";

// Compile-time checks of the published types, as a consumer sees them. Nothing here runs: `tsc -p tests-types`
// fails if a valid usage stops compiling or an expected error disappears (unused @ts-expect-error).
// CI runs this against every TypeScript and Playwright version the peer dependency ranges promise to support.

type User = { name: string };

const location: Location = { file: "a.ts", line: 1, column: 1 };
export const options: StepOptions = { box: true, location, timeout: 1 };
// @ts-expect-error -- location is checked against Playwright's real Location type
export const badOptions: StepOptions = { location: { file: 1 } };

export type Keys = ValuePlaceholderKeys<"a __x__ b __y__ report__{{z}}__end">;
export const keyX: Keys = "x";
export const keyY: Keys = "y";
// @ts-expect-error -- a span containing a placeholder is not a key
export const notAKey: Keys = "{{z}}";
export type Values = StepValues<"__x__", [User]>;

export class Page {
	@step()
	async noDescription(): Promise<void> {}

	@step({ timeout: 1 })
	async onlyOptions(): Promise<void> {}

	@step("Named {{value}}")
	named(value: string): Promise<void> {
		void value;
		return stepResult();
	}

	@step("Literal __text__")
	async literal(): Promise<void> {}

	@step("Selector __key__", { values: { key: user => user.name } })
	selector(user: User): Promise<void> {
		void user;
		return stepResult();
	}

	@step("Two __key__ __other__", { values: { key: user => user.name, other: (_user, count) => count.toFixed() } })
	twoSelectors(user: User, count: number): Promise<void> {
		void user;
		void count;
		return stepResult();
	}

	@step("Optional __key__", { values: { key: user => user?.name } })
	optional(user?: User): Promise<void> {
		void user;
		return stepResult();
	}

	@step("Static __key__", { values: { key: user => user.name } })
	static inStatic(user: User): Promise<void> {
		void user;
		return stepResult();
	}

	// @ts-expect-error -- __other__ has no selector
	@step("Missing __key__ __other__", { values: { key: user => user.name } })
	missingSelector(user: User): Promise<void> {
		void user;
		return stepResult();
	}

	// @ts-expect-error -- extra is not a placeholder in the description
	@step("Extra __key__", { values: { key: user => user.name, extra: () => 1 } })
	extraSelector(user: User): Promise<void> {
		void user;
		return stepResult();
	}

	// @ts-expect-error -- nope does not exist on User
	@step("Property __key__", { values: { key: user => user.nope } })
	badProperty(user: User): Promise<void> {
		void user;
		return stepResult();
	}

	// @ts-expect-error -- the first parameter is a User, not a string
	@step("Type __key__", { values: { key: (user: string) => user } })
	badParameterType(user: User): Promise<void> {
		void user;
		return stepResult();
	}

	// @ts-expect-error -- user may be undefined, so the selector has to handle it
	@step("Unsafe __key__", { values: { key: user => user.name } })
	unsafeOptional(user?: User): Promise<void> {
		void user;
		return stepResult();
	}

	// @ts-expect-error -- a decorated method must return a promise
	@step("Sync")
	notAsync(): number {
		return 1;
	}
}

export const resolvedValue: Promise<string> = stepResult("text");
export const resolvedFactory: Promise<number> = stepResult(() => 1);
export const resolvedVoid: Promise<void> = stepResult();
// @ts-expect-error -- function inputs are called without arguments
void stepResult((text: string) => text.length);
// @ts-expect-error -- a class can't be called without `new`
void stepResult(Page);

const info: TestStepInfo = getStepInfo();
void info.attach;
// @ts-expect-error -- the return type is Playwright's real TestStepInfo, not any
void info.nope;
