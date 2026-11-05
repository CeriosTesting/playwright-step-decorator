import { AsyncLocalStorage } from "node:async_hooks";
import { inspect } from "node:util";

import { test, TestStepInfo } from "@playwright/test";
import type { Location } from "@playwright/test";

const stepContext = new AsyncLocalStorage<TestStepInfo>();

type StepMethod<This, Args extends unknown[], ReturnType> = (this: This, ...args: Args) => Promise<ReturnType>;
type NonFunctionValue<T> = T extends (...args: unknown[]) => unknown ? never : T;
/**
 * Playwright `test.step()` options forwarded by the `@step` decorator.
 */
export type StepOptions = {
	box?: boolean;
	location?: Location;
	timeout?: number;
};
/**
 * Blocks inference from a position (polyfill for the built-in `NoInfer`, which requires TypeScript 5.4+).
 */
type NoInferArgs<T> = [T][T extends unknown ? 0 : never];
/**
 * A lambda that receives the decorated method's arguments and returns the value printed for a `__key__` placeholder.
 */
export type StepValueSelector<Args extends unknown[]> = (...args: NoInferArgs<Args>) => unknown;
/**
 * Extracts the keys of all `__key__` placeholders from a literal description type.
 * Empty keys and keys containing whitespace are skipped (their closing `__` may open the next placeholder),
 * matching the runtime behaviour.
 */
export type ValuePlaceholderKeys<Description extends string> =
	Description extends `${string}__${infer Key}__${infer Rest}`
		? Key extends "" | `${string}${" " | "\t" | "\n"}${string}`
			? ValuePlaceholderKeys<`__${Rest}`>
			: Key | ValuePlaceholderKeys<Rest>
		: never;
/**
 * The `values` option for a given description: one selector per `__key__` placeholder.
 */
export type StepValues<Description extends string, Args extends unknown[]> = string extends Description
	? Record<string, StepValueSelector<Args>>
	: { [Key in ValuePlaceholderKeys<Description>]: StepValueSelector<Args> };
/**
 * Step options including the `values` selectors for `__key__` placeholders.
 */
export type StepOptionsWithValues<Description extends string, Args extends unknown[]> = StepOptions & {
	values: StepValues<Description, Args>;
};
type PlainDescription<Description extends string> = string extends Description
	? Description
	: [ValuePlaceholderKeys<Description>] extends [never]
		? Description
		: never;
type StepDecorator<Args extends unknown[]> = <This, ReturnType>(
	target: StepMethod<This, Args, ReturnType>,
	context: ClassMethodDecoratorContext<This, StepMethod<This, Args, ReturnType>>
) => StepMethod<This, Args, ReturnType>;
type GenericStepDecorator = <This, Args extends unknown[], ReturnType>(
	target: StepMethod<This, Args, ReturnType>,
	context: ClassMethodDecoratorContext<This, StepMethod<This, Args, ReturnType>>
) => StepMethod<This, Args, ReturnType>;
type RuntimeStepOptions = StepOptions & { values?: Record<string, (...args: unknown[]) => unknown> };
type StepDescriptionOrOptions = string | RuntimeStepOptions;
type ParsedDefaultValue = { kind: "resolved"; value: unknown } | { kind: "unresolved"; source: string };
type ParsedParameter =
	| { kind: "named"; defaultValue?: ParsedDefaultValue; index: number; isRest: boolean; name: string }
	| { kind: "unsupported"; index: number; source: string };
type PlaceholderToken = { end: number; start: number } & (
	| { kind: "named"; path: string }
	| { index: number; kind: "index" }
	| { key: string; kind: "value" }
);
type NamedParameterLookup = ReadonlyMap<string, { defaultValue?: ParsedDefaultValue; index: number; isRest: boolean }>;

let decoratorModulePath: string | undefined;

/**
 * Returns a resolved promise for non-async `@step` methods.
 */
export function stepResult(): Promise<void>;
export function stepResult<T>(factory: () => T): Promise<Awaited<T>>;
export function stepResult<T>(value: NonFunctionValue<T>): Promise<Awaited<T>>;
export function stepResult(valueOrFactory?: unknown) {
	if (typeof valueOrFactory === "function") {
		return Promise.resolve().then(valueOrFactory as () => unknown);
	}
	return Promise.resolve(valueOrFactory);
}
/**
 * Decorator to wrap a promise-returning method in a Playwright step with a dynamic description.
 *
 * If no description is provided, the step will use the format: `ClassName.methodName`.
 *
 * Placeholders in the description (e.g. `{{user.name}}` or `[[0]]`) will be replaced with actual argument values at runtime.
 *
 * `__key__` placeholders are replaced with the result of the matching lambda in the `values` option. Each lambda
 * receives the decorated method's arguments with their real types, and the compiler checks that every `__key__`
 * in a literal description has exactly one matching selector.
 *
 * @template This The type of the class instance.
 * @template Args The argument types of the decorated method.
 * @template ReturnType The return type of the decorated method.
 * @param descriptionOrOptions Optional step description, or Playwright step options when no description is needed.
 * @param options Optional Playwright step options when a description string is provided. If `location` is omitted, the decorator captures the current call site automatically.
 * @returns A decorator function that wraps the target method in a Playwright step.
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
 *   @step("Reset the form")
 *   resetForm(): Promise<void> { return stepResult(); } // No `async` keyword needed (avoids require-await)
 *
 *   @step("Build greeting for {{name}}")
 *   buildGreeting(name: string): Promise<string> {
 *     return stepResult(`Hello ${name}`);
 *   }
 *
 *   @step("Prepare greeting for {{name}}")
 *   prepareGreeting(name: string): Promise<string> {
 *     return stepResult(() => {
 *       const greeting = `Hello ${name}`;
 *       return greeting.toUpperCase();
 *     });
 *   }
 *
 *   @step("Login as __name__ (contact: __second__)", {
 *     values: {
 *       name: (user) => user.name,                 // user: { name: string } (inferred)
 *       second: (_user, contacts) => contacts[1],  // contacts: string[] (inferred)
 *     },
 *   })
 *   async loginWithContacts(user: { name: string }, contacts: string[]) { ... }
 *
 *   @step()
 *   async defaultStep() { ... } // Step will be "MyTest.defaultStep"
 * }
 * ```
 *
 * @throws {Error} If placeholders reference missing or out-of-bounds parameters.
 * @throws {Error} If property access in a placeholder is invalid.
 * @throws {Error} If a `__key__` placeholder has no selector in `values`, or its selector throws.
 */
export function step(): GenericStepDecorator;
export function step(options: StepOptions): GenericStepDecorator;
export function step<const Description extends string, Args extends unknown[]>(
	description: Description,
	options: StepOptionsWithValues<Description, Args>
): StepDecorator<Args>;
export function step<const Description extends string>(
	description: PlainDescription<Description>,
	options?: StepOptions
): GenericStepDecorator;
export function step(descriptionOrOptions?: StepDescriptionOrOptions, options?: RuntimeStepOptions) {
	const description = typeof descriptionOrOptions === "string" ? descriptionOrOptions : undefined;
	const resolvedOptions = typeof descriptionOrOptions === "string" ? options : (descriptionOrOptions ?? options);

	return createStepDecorator(description, resolvedOptions);
}

function createStepDecorator(description?: string, options?: RuntimeStepOptions) {
	const { values, ...stepOptions } = options ?? {};

	return function <This extends { constructor: { name: string } }, Args extends unknown[], ReturnType>(
		target: StepMethod<This, Args, ReturnType>,
		context: ClassMethodDecoratorContext<This, StepMethod<This, Args, ReturnType>>
	) {
		return function replacementMethod(this: This, ...args: Args) {
			const methodName = `${this.constructor.name}.${context.name as string}`;
			let formattedDescription = methodName;
			if (description) {
				const tokens = tokenizeDescription(description);
				const parameterLookup = createNamedParameterLookup(target, methodName, tokens);

				formattedDescription = formatDescription(methodName, description, tokens, parameterLookup, args, values);
			}

			const location = stepOptions.location ?? captureCallSiteLocation();

			return test.step(
				formattedDescription,
				async step => {
					return await stepContext.run(step, async () => {
						try {
							return await target.call(this, ...args);
						} catch (error) {
							if (error instanceof Error && error.stack) {
								error.stack = filterDecoratorFrames(error.stack);
							}
							throw error;
						}
					});
				},
				{ ...stepOptions, location }
			);
		};
	};
}

/**
 * Retrieves the `TestStepInfo` associated with the current Step Decorator call.
 *
 * This function reads the step context from async-local storage. The optional instance parameter
 * is retained for backwards compatibility with earlier versions that stored the step on `this`.
 * If the step context is not found, it throws an error indicating that the method should be decorated with `@step`.
 *
 * @returns The `TestStepInfo` associated with the instance.
 * @throws {Error} If no Playwright step context is found on the instance.
 */
export function getStepInfo(): TestStepInfo;
export function getStepInfo(instance: unknown): TestStepInfo;
export function getStepInfo(_instance?: unknown): TestStepInfo {
	const step = stepContext.getStore();
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
	const currentDecoratorModulePath = getDecoratorModulePath();

	const lines = stack.split("\n");
	// Skip the first few stack frames:
	// 0: Error
	// 1: captureCallSiteLocation
	// 2: replacementMethod (the decorator wrapper)
	// 3: actual call site (what we want)
	for (let i = 3; i < lines.length; i++) {
		const location = extractStackFrameLocation(lines[i]);
		if (location && !isIgnoredCallSitePath(location.file, currentDecoratorModulePath)) {
			return location;
		}
	}
	return undefined;
}

function extractStackFrameLocation(stackLine: string): { file: string; line: number; column: number } | undefined {
	const match = stackLine.match(/\((.+):(\d+):(\d+)\)$/) || stackLine.match(/at\s+(.+):(\d+):(\d+)$/);
	if (!match) {
		return undefined;
	}

	const [, file, line, column] = match;
	return {
		file: normalizeStackPath(file),
		line: parseInt(line, 10),
		column: parseInt(column, 10),
	};
}

function normalizeStackPath(value: string): string {
	let result = value.trim();
	result = result.replace(/^(webpack|vite|rollup):\/\//, "");
	if (result.startsWith("file:///") && /^[A-Za-z]:/.test(result.slice("file:///".length))) {
		result = result.slice("file:///".length);
	} else {
		result = result.replace(/^file:\/\//, "");
	}
	try {
		result = decodeURIComponent(result);
	} catch {
		// Leave undecodable stack paths untouched.
	}
	result = result.replace(/\\/g, "/");
	return result;
}

function isIgnoredCallSitePath(normalizedPath: string, currentDecoratorModulePath?: string): boolean {
	return (
		normalizedPath.includes("node:internal") ||
		normalizedPath.includes("/node_modules/") ||
		isDecoratorInternalPath(normalizedPath, currentDecoratorModulePath)
	);
}

function isDecoratorInternalPath(normalizedPath: string, currentDecoratorModulePath?: string): boolean {
	return normalizedPath === currentDecoratorModulePath || matchesKnownDecoratorArtifactPath(normalizedPath);
}

function matchesKnownDecoratorArtifactPath(normalizedPath: string): boolean {
	return [
		/\/node_modules\/@cerios\/playwright-step-decorator\/(?:src|dist)\/playwright-step-decorator(?:\.(?:ts|js|cjs|mjs))?$/u,
		/\/node_modules\/playwright-step-decorator\/(?:src|dist)\/playwright-step-decorator(?:\.(?:ts|js|cjs|mjs))?$/u,
		/\/packages\/playwright-step-decorator\/(?:src|dist)\/playwright-step-decorator(?:\.(?:ts|js|cjs|mjs))?$/u,
		/\/playwright-step-decorator\/src\/playwright-step-decorator\.ts$/u,
		/\/playwright-step-decorator\/dist\/playwright-step-decorator\.(?:js|cjs|mjs)$/u,
	].some(pattern => pattern.test(normalizedPath));
}

function getDecoratorModulePath(): string | undefined {
	if (decoratorModulePath) {
		return decoratorModulePath;
	}

	const stack = new Error().stack;
	if (!stack) {
		return undefined;
	}

	for (const line of stack.split("\n").slice(1)) {
		const location = extractStackFrameLocation(line);
		if (location) {
			decoratorModulePath = location.file;
			return decoratorModulePath;
		}
	}

	return undefined;
}

/**
 * Splits a description into placeholder tokens, ordered by position.
 *
 * `__key__` spans are located first using the same rule as the `ValuePlaceholderKeys` type: find the next `__`,
 * take everything up to the following `__` as the key, and accept it when it is non-empty and has no whitespace.
 * An invalid span is skipped and its closing `__` may open the next span.
 * `{{path}}` and `[[index]]` placeholders that overlap a `__key__` span are ignored.
 */
function tokenizeDescription(description: string): PlaceholderToken[] {
	const valueTokens: PlaceholderToken[] = [];
	let searchFrom = 0;
	while (searchFrom < description.length) {
		const open = description.indexOf("__", searchFrom);
		if (open === -1) break;
		const close = description.indexOf("__", open + 2);
		if (close === -1) break;

		const key = description.slice(open + 2, close);
		if (isValidValuePlaceholderKey(key)) {
			valueTokens.push({ kind: "value", key, start: open, end: close + 2 });
			searchFrom = close + 2;
		} else {
			searchFrom = close;
		}
	}

	const overlapsValueToken = (start: number, end: number) =>
		valueTokens.some(token => start < token.end && token.start < end);

	const argumentTokens: PlaceholderToken[] = [];
	for (const match of description.matchAll(/\{\{(.*?)\}\}|\[\[(\d+)\]\]/g)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (overlapsValueToken(start, end)) continue;

		if (match[1] !== undefined) {
			argumentTokens.push({ kind: "named", path: match[1], start, end });
		} else {
			argumentTokens.push({ kind: "index", index: parseInt(match[2], 10), start, end });
		}
	}

	return [...valueTokens, ...argumentTokens].sort((a, b) => a.start - b.start);
}

function isValidValuePlaceholderKey(key: string): boolean {
	return key !== "" && !/[ \t\n]/u.test(key);
}

function createNamedParameterLookup(
	target: Function,
	methodName: string,
	tokens: PlaceholderToken[]
): Map<string, { defaultValue?: ParsedDefaultValue; index: number; isRest: boolean }> {
	const namedPlaceholderRoots = Array.from(
		new Set(tokens.flatMap(token => (token.kind === "named" ? [token.path.split(".")[0]] : [])))
	);
	if (namedPlaceholderRoots.length === 0) {
		return new Map();
	}

	const parsedParameters = parseFunctionParameters(target);
	if (!parsedParameters) {
		throw new Error(
			`Unable to parse the parameter list for method '${methodName}' while resolving named @step placeholders (${namedPlaceholderRoots.join(", ")}). ` +
				`Named placeholders support identifier parameters, default values, and rest parameters. ` +
				`Use index placeholders like [[0]] when the signature uses destructuring or other unsupported syntax.`
		);
	}

	const parameterLookup = new Map<string, { defaultValue?: ParsedDefaultValue; index: number; isRest: boolean }>();
	const unsupportedParameters: string[] = [];

	for (const parameter of parsedParameters) {
		if (parameter.kind === "named") {
			parameterLookup.set(parameter.name, {
				defaultValue: parameter.defaultValue,
				index: parameter.index,
				isRest: parameter.isRest,
			});
		} else {
			unsupportedParameters.push(parameter.source);
		}
	}

	const missingParams = namedPlaceholderRoots.filter(param => !parameterLookup.has(param));
	if (missingParams.length > 0) {
		if (unsupportedParameters.length > 0) {
			throw new Error(
				`Unable to resolve named @step placeholders (${missingParams.join(", ")}) in method '${methodName}' because this signature contains parameters that cannot be matched by name (${unsupportedParameters.join(", ")}). ` +
					`Named placeholders support identifier parameters, default values, and rest parameters. ` +
					`Use index placeholders like [[0]] for destructured or unsupported parameters.`
			);
		}

		throw new Error(
			`Missing function parameters (${missingParams.join(", ")}) in method '${methodName}'. Please check your @step decorator placeholders.`
		);
	}

	return parameterLookup;
}

function parseFunctionParameters(target: Function): ParsedParameter[] | undefined {
	const fnStr = target.toString();
	const openParenIndex = fnStr.indexOf("(");
	if (openParenIndex === -1) {
		return undefined;
	}

	const closeParenIndex = findMatchingClosingParen(fnStr, openParenIndex);
	if (closeParenIndex === -1) {
		return undefined;
	}

	const rawParameters = splitTopLevel(fnStr.slice(openParenIndex + 1, closeParenIndex), ",");
	if (!rawParameters) {
		return undefined;
	}

	return rawParameters
		.map((parameter, index) => parseFunctionParameter(parameter, index))
		.filter((parameter): parameter is ParsedParameter => parameter !== undefined);
}

function parseFunctionParameter(parameterSource: string, index: number): ParsedParameter | undefined {
	const normalizedSource = normalizeParameterSource(parameterSource);
	if (!normalizedSource) {
		return undefined;
	}

	const defaultValueIndex = findFirstTopLevelCharacter(normalizedSource, "=");
	const defaultValueSource =
		defaultValueIndex === undefined ? undefined : normalizedSource.slice(defaultValueIndex + 1).trim();
	const bindingSource =
		defaultValueIndex === undefined ? normalizedSource : normalizedSource.slice(0, defaultValueIndex).trim();
	let candidate = bindingSource;
	let isRest = false;
	const summarizedSource = summarizeParameterSource(normalizedSource);

	if (candidate.startsWith("...")) {
		isRest = true;
		candidate = candidate.slice(3).trim();
	}

	if (candidate.startsWith("{") || candidate.startsWith("[")) {
		return { kind: "unsupported", index, source: summarizedSource };
	}

	if (/^[A-Za-z_$][\w$]*$/u.test(candidate)) {
		return {
			kind: "named",
			defaultValue: isRest ? undefined : parseDefaultValue(defaultValueSource),
			index,
			isRest,
			name: candidate,
		};
	}

	return { kind: "unsupported", index, source: summarizedSource };
}

function normalizeParameterSource(source: string): string {
	return source.replace(/\s+/g, " ").trim();
}

function parseDefaultValue(defaultValueSource?: string): ParsedDefaultValue | undefined {
	if (!defaultValueSource) {
		return undefined;
	}

	const parsedDefaultValue = parseLiteralDefaultValue(defaultValueSource);
	if (parsedDefaultValue !== undefined || defaultValueSource === "undefined") {
		return { kind: "resolved", value: parsedDefaultValue };
	}

	return { kind: "unresolved", source: summarizeParameterSource(defaultValueSource) };
}

function parseLiteralDefaultValue(source: string): unknown {
	if (source === "undefined") {
		return undefined;
	}

	if (source === "null") {
		return null;
	}

	if (source === "true") {
		return true;
	}

	if (source === "false") {
		return false;
	}

	if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u.test(source)) {
		return Number(source);
	}

	if (/^-?(?:0|[1-9]\d*)n$/u.test(source)) {
		return BigInt(source.slice(0, -1));
	}

	return parseQuotedStringLiteral(source);
}

function parseQuotedStringLiteral(source: string): string | undefined {
	if (source.length < 2) {
		return undefined;
	}

	const quote = source[0];
	if ((quote !== '"' && quote !== "'") || source[source.length - 1] !== quote) {
		return undefined;
	}

	let result = "";
	for (let i = 1; i < source.length - 1; i++) {
		const char = source[i];
		if (char !== "\\") {
			result += char;
			continue;
		}

		i += 1;
		if (i >= source.length - 1) {
			return undefined;
		}

		const escape = source[i];
		switch (escape) {
			case "'":
			case '"':
			case "\\":
				result += escape;
				break;
			case "b":
				result += "\b";
				break;
			case "f":
				result += "\f";
				break;
			case "n":
				result += "\n";
				break;
			case "r":
				result += "\r";
				break;
			case "t":
				result += "\t";
				break;
			case "v":
				result += "\v";
				break;
			case "0":
				result += "\0";
				break;
			case "u": {
				const unicodeValue = source.slice(i + 1, i + 5);
				if (!/^[0-9A-Fa-f]{4}$/u.test(unicodeValue)) {
					return undefined;
				}
				result += String.fromCodePoint(parseInt(unicodeValue, 16));
				i += 4;
				break;
			}
			case "x": {
				const hexValue = source.slice(i + 1, i + 3);
				if (!/^[0-9A-Fa-f]{2}$/u.test(hexValue)) {
					return undefined;
				}
				result += String.fromCodePoint(parseInt(hexValue, 16));
				i += 2;
				break;
			}
			default:
				return undefined;
		}
	}

	return result;
}

function findMatchingClosingParen(source: string, openParenIndex: number): number {
	let depth = 0;
	let quote: "'" | '"' | undefined;
	let inLineComment = false;
	let inBlockComment = false;

	for (let i = openParenIndex; i < source.length; i++) {
		const char = source[i];
		const next = source[i + 1];

		if (inLineComment) {
			if (char === "\n") {
				inLineComment = false;
			}
			continue;
		}

		if (inBlockComment) {
			if (char === "*" && next === "/") {
				inBlockComment = false;
				i += 1;
			}
			continue;
		}

		if (quote) {
			if (char === "\\") {
				i += 1;
				continue;
			}

			if (char === quote) {
				quote = undefined;
			}
			continue;
		}

		if (char === "`") {
			return -1;
		}

		if (char === "/" && next === "/") {
			inLineComment = true;
			i += 1;
			continue;
		}

		if (char === "/" && next === "*") {
			inBlockComment = true;
			i += 1;
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}

		if (char === "(") {
			depth += 1;
			continue;
		}

		if (char === ")") {
			depth -= 1;
			if (depth === 0) {
				return i;
			}
			if (depth < 0) {
				return -1;
			}
		}
	}

	return -1;
}

function splitTopLevel(source: string, delimiter: string): string[] | undefined {
	const parts: string[] = [];
	let start = 0;
	let parenDepth = 0;
	let braceDepth = 0;
	let bracketDepth = 0;
	let quote: "'" | '"' | undefined;
	let inLineComment = false;
	let inBlockComment = false;

	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		const next = source[i + 1];

		if (inLineComment) {
			if (char === "\n") {
				inLineComment = false;
			}
			continue;
		}

		if (inBlockComment) {
			if (char === "*" && next === "/") {
				inBlockComment = false;
				i += 1;
			}
			continue;
		}

		if (quote) {
			if (char === "\\") {
				i += 1;
				continue;
			}

			if (char === quote) {
				quote = undefined;
			}
			continue;
		}

		if (char === "`") {
			return undefined;
		}

		if (char === "/" && next === "/") {
			inLineComment = true;
			i += 1;
			continue;
		}

		if (char === "/" && next === "*") {
			inBlockComment = true;
			i += 1;
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}

		if (char === delimiter && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
			parts.push(source.slice(start, i));
			start = i + 1;
			continue;
		}

		if (char === "(") {
			parenDepth += 1;
			continue;
		}

		if (char === ")") {
			parenDepth -= 1;
			if (parenDepth < 0) {
				return undefined;
			}
			continue;
		}

		if (char === "{") {
			braceDepth += 1;
			continue;
		}

		if (char === "}") {
			braceDepth -= 1;
			if (braceDepth < 0) {
				return undefined;
			}
			continue;
		}

		if (char === "[") {
			bracketDepth += 1;
			continue;
		}

		if (char === "]") {
			bracketDepth -= 1;
			if (bracketDepth < 0) {
				return undefined;
			}
		}
	}

	if (quote || inBlockComment || parenDepth !== 0 || braceDepth !== 0 || bracketDepth !== 0) {
		return undefined;
	}

	parts.push(source.slice(start));
	return parts;
}

function findFirstTopLevelCharacter(source: string, character: string): number | undefined {
	let parenDepth = 0;
	let braceDepth = 0;
	let bracketDepth = 0;
	let quote: "'" | '"' | undefined;
	let inLineComment = false;
	let inBlockComment = false;

	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		const next = source[i + 1];

		if (inLineComment) {
			if (char === "\n") {
				inLineComment = false;
			}
			continue;
		}

		if (inBlockComment) {
			if (char === "*" && next === "/") {
				inBlockComment = false;
				i += 1;
			}
			continue;
		}

		if (quote) {
			if (char === "\\") {
				i += 1;
				continue;
			}

			if (char === quote) {
				quote = undefined;
			}
			continue;
		}

		if (char === "`") {
			return undefined;
		}

		if (char === "/" && next === "/") {
			inLineComment = true;
			i += 1;
			continue;
		}

		if (char === "/" && next === "*") {
			inBlockComment = true;
			i += 1;
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}

		if (char === character && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
			return i;
		}

		if (char === "(") {
			parenDepth += 1;
			continue;
		}

		if (char === ")") {
			parenDepth -= 1;
			if (parenDepth < 0) {
				return undefined;
			}
			continue;
		}

		if (char === "{") {
			braceDepth += 1;
			continue;
		}

		if (char === "}") {
			braceDepth -= 1;
			if (braceDepth < 0) {
				return undefined;
			}
			continue;
		}

		if (char === "[") {
			bracketDepth += 1;
			continue;
		}

		if (char === "]") {
			bracketDepth -= 1;
			if (bracketDepth < 0) {
				return undefined;
			}
		}
	}

	if (quote || inBlockComment || parenDepth !== 0 || braceDepth !== 0 || bracketDepth !== 0) {
		return undefined;
	}

	return undefined;
}

function summarizeParameterSource(source: string): string {
	const summary = source.replace(/\s+/g, " ").trim();
	return summary.length > 60 ? `${summary.slice(0, 57)}...` : summary;
}

function formatDescription(
	methodName: string,
	description: string,
	tokens: PlaceholderToken[],
	parameterLookup: NamedParameterLookup,
	args: unknown[],
	values?: Record<string, (...args: unknown[]) => unknown>
): string {
	// Resolve named placeholders first, then index placeholders, then value placeholders, so error precedence
	// stays the same as before. The description is then assembled in a single pass over the original string,
	// which means substituted values are never scanned for placeholders again.
	const kindOrder: Record<PlaceholderToken["kind"], number> = { named: 0, index: 1, value: 2 };
	const resolved = new Map<PlaceholderToken, string>();
	for (const token of [...tokens].sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind])) {
		resolved.set(
			token,
			formatPlaceholderValue(resolvePlaceholderToken(methodName, token, parameterLookup, args, values))
		);
	}

	let result = "";
	let cursor = 0;
	for (const token of tokens) {
		result += description.slice(cursor, token.start) + resolved.get(token);
		cursor = token.end;
	}
	return result + description.slice(cursor);
}

function resolvePlaceholderToken(
	methodName: string,
	token: PlaceholderToken,
	parameterLookup: NamedParameterLookup,
	args: unknown[],
	values?: Record<string, (...args: unknown[]) => unknown>
): unknown {
	if (token.kind === "index") {
		const index = token.index;
		if (isNaN(index) || index < 0 || index >= args.length) {
			throw new Error(
				`Parameter index '${index}' is out of bounds in method '${methodName}'. ` +
					`This method received ${args.length} argument(s), but the @step decorator references index ${index}. ` +
					`Please check your @step decorator placeholders.`
			);
		}
		return args[index];
	}

	if (token.kind === "value") {
		return resolveValuePlaceholder(methodName, token.key, args, values);
	}

	const placeholder = token.path;
	const parts = placeholder.split(".");
	const parameter = parameterLookup.get(parts[0]);
	if (!parameter) {
		throw new Error(
			`Missing function parameters (${parts[0]}) in method '${methodName}'. Please check your @step decorator placeholders.`
		);
	}
	let value: unknown = resolveNamedParameterValue(methodName, parts[0], placeholder, parameter, args);

	for (let i = 1; i < parts.length; i++) {
		if (value === undefined || value === null) {
			// Short-circuit like optional chaining and print the nullish value itself.
			break;
		}
		if (typeof value === "object" && parts[i] in value) {
			value = (value as Record<string, unknown>)[parts[i]];
		} else {
			throw new Error(
				`Invalid @step placeholder '{{${placeholder}}}' in method '${methodName}': ` +
					`Property '${parts[i]}' does not exist on parameter '${parts[0]}'. ` +
					`Please check your @step decorator placeholders.`
			);
		}
	}

	return value;
}

function resolveValuePlaceholder(
	methodName: string,
	key: string,
	args: unknown[],
	values?: Record<string, (...args: unknown[]) => unknown>
): unknown {
	const selector = values && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
	if (typeof selector !== "function") {
		throw new Error(
			`Missing value selector for placeholder '__${key}__' in method '${methodName}'. ` +
				`Add a '${key}' entry to the "values" option of the @step decorator.`
		);
	}

	try {
		return selector(...args);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const wrapped = new Error(
			`Value selector for placeholder '__${key}__' in method '${methodName}' threw: ${message}`
		);
		// Set `cause` manually: the `Error(message, { cause })` overload is not part of the ES2019 lib this package targets.
		Object.defineProperty(wrapped, "cause", { configurable: true, enumerable: false, value: error, writable: true });
		throw wrapped;
	}
}

function resolveNamedParameterValue(
	methodName: string,
	parameterName: string,
	placeholder: string,
	parameter: { defaultValue?: ParsedDefaultValue; index: number; isRest: boolean },
	args: unknown[]
): unknown {
	if (parameter.isRest) {
		return args.slice(parameter.index);
	}

	if (args[parameter.index] !== undefined) {
		return args[parameter.index];
	}

	if (parameter.defaultValue?.kind === "resolved") {
		return parameter.defaultValue.value;
	}

	if (parameter.defaultValue?.kind === "unresolved") {
		throw new Error(
			`Unable to resolve the default value for parameter '${parameterName}' in method '${methodName}' while formatting @step placeholder '{{${placeholder}}}'. ` +
				`Only literal default values can be printed when the argument is omitted. ` +
				`Pass the argument explicitly or use an index placeholder instead.`
		);
	}

	return args[parameter.index];
}

function formatPlaceholderValue(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint" ||
		typeof value === "undefined" ||
		value === null
	) {
		return String(value);
	}

	if (typeof value === "function") {
		return value.name ? `[Function ${value.name}]` : "[Function anonymous]";
	}

	if (value instanceof Error) {
		return `${value.name}: ${value.message}`;
	}

	try {
		const seen = new WeakSet<object>();
		const serialized = JSON.stringify(value, (_key, nestedValue) => {
			if (typeof nestedValue === "bigint") {
				return nestedValue.toString();
			}

			if (typeof nestedValue === "function") {
				return nestedValue.name ? `[Function ${nestedValue.name}]` : "[Function anonymous]";
			}

			if (typeof nestedValue === "symbol") {
				return nestedValue.toString();
			}

			if (nestedValue && typeof nestedValue === "object") {
				if (seen.has(nestedValue)) {
					return "[Circular]";
				}

				seen.add(nestedValue);
			}

			return nestedValue;
		});

		if (serialized !== undefined) {
			return serialized;
		}
	} catch {
		// Fall back to the built-in formatter when JSON serialization fails.
	}

	return inspect(value, { breakLength: Infinity, depth: 2 });
}

function filterDecoratorFrames(stack: string): string {
	const currentDecoratorModulePath = getDecoratorModulePath();
	const lines = stack.split("\n");
	const filtered = lines.filter((line, index) => {
		if (index === 0) {
			return true;
		}

		const location = extractStackFrameLocation(line);
		return !location || !isDecoratorInternalPath(location.file, currentDecoratorModulePath);
	});
	return filtered.join("\n");
}
