import { test, TestStepInfo } from "@playwright/test";

export type MockLocation = { file: string; line: number; column: number };
export type MockStepOptions = { box?: boolean; location?: MockLocation; timeout?: number };

export const collectedSteps: string[] = [];
export const collectedLocations: Array<MockLocation | undefined> = [];
export const collectedStepOptions: Array<MockStepOptions | undefined> = [];
export let nextMockStepId = 1;

type MockStepInfo = {
	readonly id: number;
	attach: TestStepInfo["attach"];
	skip: TestStepInfo["skip"];
};

export const resetCollected = (): void => {
	collectedSteps.length = 0;
	collectedLocations.length = 0;
	collectedStepOptions.length = 0;
	nextMockStepId = 1;
};

export type Deferred<T> = { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void };

export const createDeferred = <T = void>(): Deferred<T> => {
	let resolveDeferred!: Deferred<T>["resolve"];
	const promise = new Promise<T>(resolve => {
		resolveDeferred = resolve;
	});
	return { promise, resolve: resolveDeferred };
};

export const withMockedErrorStack = async (stack: string, action: () => Promise<void>): Promise<void> => {
	const originalError = globalThis.Error;
	class MockError extends originalError {
		override stack: string;

		constructor(message?: string) {
			super(message);
			this.stack = stack;
		}
	}

	Object.defineProperty(globalThis, "Error", {
		configurable: true,
		writable: true,
		value: MockError,
	});

	try {
		await action();
	} finally {
		Object.defineProperty(globalThis, "Error", {
			configurable: true,
			writable: true,
			value: originalError,
		});
	}
};

export const mockTestStep = async (
	desc: string,
	fn: (step: TestStepInfo) => Promise<unknown>,
	options?: MockStepOptions
): Promise<unknown> => {
	collectedSteps.push(desc);
	collectedLocations.push(options?.location);
	collectedStepOptions.push(options ? { ...options } : undefined);
	const stepInfo: MockStepInfo = {
		id: nextMockStepId++,
		attach: async () => {},
		skip: () => {},
	};
	return await fn(stepInfo as unknown as TestStepInfo);
};

export const setupMockStep = (): void => {
	let originalStep: typeof test.step;

	test.beforeAll(() => {
		originalStep = (test as { step: typeof test.step }).step;
		// oxlint-disable-next-line typescript-eslint/no-explicit-any
		(test as any).step = mockTestStep;
	});

	test.afterAll(() => {
		// oxlint-disable-next-line typescript-eslint/no-explicit-any
		(test as any).step = originalStep;
	});

	test.beforeEach(() => {
		resetCollected();
	});
};
