import test from "@playwright/test";

/**
 * Decorator to wrap a function in a Playwright step with a dynamic description.
 * Placeholders in the description (e.g. {{user.name}} or [[0]]) will be replaced with actual argument values.
 *
 * @template T The return type of the decorated function.
 * @param description The step description, supporting placeholders like {{param}}, {{param.prop}}, or [[index]].
 * @returns A decorator function that wraps the target function in a Playwright step.
 *
 * @example
 * ```typescript
 * class MyTest {
 *   @step("Login as {{user.name}}")
 *   async login(user: { name: string }) { ... }
 *
 *   @step("Click button [[0]] times")
 *   async clickButton(times: number) { ... }
 * }
 * ```
 */
export function step<T>(description: string) {
	return function (target: (...args: any[]) => T) {
		return function (this: any, ...args: any[]): Promise<T> {
			const paramNames = extractFunctionParamNames(target);
			const placeholders = getPlaceholders(description);

			const missingParams = findMissingParams(placeholders, paramNames);
			if (missingParams.length > 0) {
				throw new Error(`Missing function parameters: ${missingParams.join(", ")}`);
			}

			const formattedDescription = formatDescription(description, placeholders, paramNames, args);

			return test.step(formattedDescription, async () => {
				const result = target.call(this, ...args);
				if (result instanceof Promise) {
					return await result;
				}
				return result;
			});
		};
	};
}

function extractFunctionParamNames(func: (...args: any[]) => any): string[] {
	const fnStr = func.toString();
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

function formatDescription(description: string, placeholders: string[], paramNames: string[], args: any[]): string {
	let result = description;
	for (const placeholder of placeholders) {
		if (placeholder.startsWith("[[") && placeholder.endsWith("]]")) {
			const index = parseInt(placeholder.slice(2, -2), 10);
			if (isNaN(index) || index < 0 || index >= args.length) {
				throw new Error(`Parameter index '${index}' is out of bounds`);
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
					throw new Error(`Property '${parts[i]}' does not exist on parameter '${parts[0]}'`);
				}
			}

			result = result.replace(`{{${placeholder}}}`, String(value));
		}
	}
	return result;
}
