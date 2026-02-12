import { test, TestStepInfo } from "@playwright/test";

const StepSymbol: unique symbol = Symbol("playwrightStep");

type AsyncMethod<This, Args extends any[], ReturnType> = (this: This, ...args: Args) => Promise<ReturnType>;
/**
 * Decorator to wrap an async method in a Playwright step with a dynamic description.
 *
 * If no description is provided, the step will use the format: `ClassName.methodName`.
 *
 * Placeholders in the description (e.g. `{{user.name}}` or `[[0]]`) will be replaced with actual argument values at runtime.
 *
 * @template This The type of the class instance.
 * @template Args The argument types of the decorated method.
 * @template ReturnType The return type of the decorated method.
 * @param description Optional step description, supporting placeholders like `{{param}}`, `{{param.prop}}`, or `[[index]]`.
 * @returns A decorator function that wraps the target async method in a Playwright step.
 *
 * @example
 * ```typescript
 * class MyTest {
 *   @step("Login as {{user.name}}")
 *   async login(user: { name: string }) { ... }
 *
 *   @step("Click button [[0]] times")
 *   async clickButton(times: number) { ... }
 *
 *   @step()
 *   async defaultStep() { ... } // Step will be "MyTest.defaultStep"
 * }
 * ```
 *
 * @throws {Error} If placeholders reference missing or out-of-bounds parameters.
 * @throws {Error} If property access in a placeholder is invalid.
 */
export function step(description?: string) {
	return function <This, Args extends any[], ReturnType>(
		target: AsyncMethod<This, Args, ReturnType>,
		context: ClassMethodDecoratorContext<This, AsyncMethod<This, Args, ReturnType>>
	) {
		return function replacementMethod(this: any, ...args: any) {
			const methodName = `${this.constructor.name}.${context.name as string}`;
			let formattedDescription = methodName;
			if (description) {
				const paramNames = extractFunctionParamNames(target);
				const placeholders = getPlaceholders(description);

				const missingParams = findMissingParams(placeholders, paramNames);
				if (missingParams.length > 0) {
					throw new Error(
						`Missing function parameters (${missingParams.join(", ")}) in method '${methodName}'. Please check your @step decorator placeholders.`
					);
				}

				formattedDescription = formatDescription(methodName, description, placeholders, paramNames, args);
			}

			// Capture the call site location for accurate reporting
			const location = captureCallSiteLocation();

			return test.step(
				formattedDescription,
				async step => {
					this[StepSymbol] = step;
					try {
						return await target.call(this, ...args);
					} catch (error) {
						if (error instanceof Error && error.stack) {
							error.stack = filterDecoratorFrames(error.stack);
						}
						throw error;
					} finally {
						delete this[StepSymbol];
					}
				},
				{ location }
			);
		};
	};
}

/**
 * Retrieves the `TestStepInfo` associated with the given Step Decorator.
 *
 * This function expects the instance to have a step context stored under the `StepSymbol` property.
 * If the step context is not found, it throws an error indicating that the method should be decorated with `@step`.
 *
 * @param instance - The object instance from which to retrieve the step context.
 * @returns The `TestStepInfo` associated with the instance.
 * @throws {Error} If no Playwright step context is found on the instance.
 */
export function getStepInfo(instance: any): TestStepInfo {
	const step = instance[StepSymbol];
	if (!step) {
		throw new Error("No Playwright step context found. Make sure this method is decorated with @step.");
	}
	return step;
}

/**
 * Captures the call site location from the stack trace.
 *
 * This function parses the Error stack to find the location where the decorated method
 * was called (not where the decorator is defined). This location is used by Playwright
 * to display accurate source locations in test reports and trace viewer.
 *
 * @returns Location object with file, line, and column, or undefined if parsing fails
 */
function captureCallSiteLocation(): { file: string; line: number; column: number } | undefined {
	const stack = new Error().stack;
	if (!stack) return undefined;

	const lines = stack.split("\n");
	const ignoredFragments = [
		"node_modules",
		"node:internal",
		"/playwright-step-decorator.ts",
		"\\playwright-step-decorator.ts",
		"/src/playwright-step-decorator",
		"\\src\\playwright-step-decorator",
		"/dist/playwright-step-decorator",
		"\\dist\\playwright-step-decorator",
	];
	// Skip the first few stack frames:
	// 0: Error
	// 1: captureCallSiteLocation
	// 2: replacementMethod (the decorator wrapper)
	// 3: actual call site (what we want)
	for (let i = 3; i < lines.length; i++) {
		const line = lines[i];
		// Match common stack trace formats:
		// at ClassName.methodName (file:line:column)
		// at file:line:column
		// at async ClassName.methodName (file:line:column)
		const match = line.match(/\((.+):(\d+):(\d+)\)$/) || line.match(/at\s+(.+):(\d+):(\d+)$/);
		if (match) {
			const [, file, lineNum, col] = match;
			// Filter out Node.js internals and the decorator module itself
			if (!ignoredFragments.some(fragment => file.includes(fragment))) {
				return {
					file,
					line: parseInt(lineNum, 10),
					column: parseInt(col, 10),
				};
			}
		}
	}
	return undefined;
}

function extractFunctionParamNames(target: Function): string[] {
	const fnStr = target.toString();
	const match = fnStr.match(/^[\s\S]*?\(([^)]*)\)/);
	if (!match) return [];
	return match[1]
		.split(",")
		.map(param => param.trim())
		.filter(param => param.length > 0);
}

function getPlaceholders(description: string): string[] {
	const curlyMatches = Array.from(description.matchAll(/\{\{(.*?)\}\}/g)).map(m => m[1]);
	const squareMatches = Array.from(description.matchAll(/\[\[(\d+)\]\]/g)).map(m => `[[${m[1]}]]`);
	return [...curlyMatches, ...squareMatches];
}

function findMissingParams(placeholders: string[], paramNames: string[]): string[] {
	return placeholders
		.filter(ph => !ph.startsWith("[["))
		.map(ph => ph.split(".")[0])
		.filter(param => !paramNames.includes(param));
}

function formatDescription(
	methodName: string,
	description: string,
	placeholders: string[],
	paramNames: string[],
	args: any[]
): string {
	let result = description;
	for (const placeholder of placeholders) {
		if (placeholder.startsWith("[[") && placeholder.endsWith("]]")) {
			const index = parseInt(placeholder.slice(2, -2), 10);
			if (isNaN(index) || index < 0 || index >= args.length) {
				throw new Error(
					`Parameter index '${index}' is out of bounds in method '${methodName}'. ` +
						`This method received ${args.length} argument(s), but the @step decorator references index ${index}. ` +
						`Please check your @step decorator placeholders.`
				);
			}
			result = result.replace(`[[${index}]]`, String(args[index]));
		} else {
			const parts = placeholder.split(".");
			const paramIndex = paramNames.indexOf(parts[0]);
			let value = args[paramIndex];

			for (let i = 1; i < parts.length; i++) {
				if (value && typeof value === "object" && parts[i] in value) {
					value = value[parts[i]];
				} else {
					throw new Error(
						`Invalid @step placeholder '{{${placeholder}}}' in method '${methodName}': ` +
							`Property '${parts[i]}' does not exist on parameter '${parts[0]}'. ` +
							`Please check your @step decorator placeholders.`
					);
				}
			}

			result = result.replace(`{{${placeholder}}}`, String(value));
		}
	}
	return result;
}

function filterDecoratorFrames(stack: string): string {
	const lines = stack.split("\n");
	const filtered = lines.filter(line => !line.includes("playwright-step-decorator"));
	return filtered.join("\n");
}
