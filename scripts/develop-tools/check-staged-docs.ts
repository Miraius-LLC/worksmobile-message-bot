#!/usr/bin/env bun
import type { Stats } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import Bun from "bun";
import {
	type Finding,
	inspectChangelog,
	inspectTodo,
} from "./_docs-standard-core";

interface Arguments {
	help: boolean;
	indexPath?: string;
}

interface GitResult {
	stdout: Buffer;
	stderr: Buffer;
	exitCode: number | null;
}

const documentNames = ["TODO.md", "CHANGELOG.md"] as const;
type DocumentName = (typeof documentNames)[number];

function parseArguments(args: string[]): Arguments {
	if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
		return { help: true };
	}
	let indexPath: string | undefined;
	for (let position = 0; position < args.length; position += 1) {
		if (args[position] !== "--index-file") {
			throw new Error(`不明な引数: ${args[position]}`);
		}
		if (indexPath !== undefined) {
			throw new Error("--index-file は 1 回だけ指定できます");
		}
		const path = args[position + 1];
		if (
			path === undefined ||
			path.length === 0 ||
			path === "--index-file" ||
			path === "--help" ||
			path === "-h"
		) {
			throw new Error("--index-file に path が必要です");
		}
		indexPath = path;
		position += 1;
	}
	return { help: false, indexPath };
}

function cleanGitEnvironment(indexFile?: string): Record<string, string> {
	const environment: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && !key.startsWith("GIT_")) {
			environment[key] = value;
		}
	}
	if (indexFile !== undefined) {
		environment.GIT_INDEX_FILE = indexFile;
	}
	return environment;
}

function git(cwd: string, args: string[], indexFile?: string): GitResult {
	return Bun.spawnSync(["git", ...args], {
		cwd,
		env: cleanGitEnvironment(indexFile),
		stdout: "pipe",
		stderr: "pipe",
	});
}

function decodeGitText(bytes: Uint8Array, label: string): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new Error(`${label} の出力が UTF-8 ではありません`);
	}
}

function gitText(cwd: string, args: string[], indexFile?: string): string {
	let result: GitResult;
	try {
		result = git(cwd, args, indexFile);
	} catch (error) {
		throw new Error(
			`git ${args.join(" ")} を起動できません: ${errorText(error)}`,
		);
	}
	if (result.exitCode !== 0) {
		throw new Error(
			"git " +
				args.join(" ") +
				" が失敗しました: " +
				decodeGitText(result.stderr, "Git error"),
		);
	}
	return decodeGitText(result.stdout, "Git output").replace(/\r?\n$/, "");
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function repositoryRoot(cwd: string): Promise<string> {
	return gitText(cwd, ["rev-parse", "--show-toplevel"]);
}

function isPathWithin(parent: string, child: string): boolean {
	const childFromParent = relative(parent, child);
	return (
		childFromParent.length > 0 &&
		childFromParent !== ".." &&
		!childFromParent.startsWith(`..${sep}`) &&
		!isAbsolute(childFromParent)
	);
}

async function resolveIndexFile(
	startingDirectory: string,
	repository: string,
	rawPath: string,
): Promise<string> {
	const unresolved = isAbsolute(rawPath)
		? rawPath
		: resolve(startingDirectory, rawPath);
	let unresolvedInfo: Stats;
	try {
		unresolvedInfo = await lstat(unresolved);
	} catch (error) {
		throw new Error(
			`明示 index を確認できません: ${unresolved}: ${errorText(error)}`,
		);
	}
	if (unresolvedInfo.isSymbolicLink()) {
		throw new Error(`明示 index は symlink にできません: ${unresolved}`);
	}
	if (!unresolvedInfo.isFile()) {
		throw new Error(
			`明示 index は通常 file である必要があります: ${unresolved}`,
		);
	}

	let indexPath: string;
	try {
		indexPath = await realpath(unresolved);
	} catch (error) {
		throw new Error(
			`明示 index を読み取れません: ${unresolved}: ${errorText(error)}`,
		);
	}
	let indexInfo: Stats;
	try {
		indexInfo = await stat(indexPath);
	} catch (error) {
		throw new Error(
			`明示 index を確認できません: ${indexPath}: ${errorText(error)}`,
		);
	}
	if (!indexInfo.isFile()) {
		throw new Error(
			`明示 index は通常 file である必要があります: ${indexPath}`,
		);
	}

	const rawGitDirectory = gitText(repository, [
		"rev-parse",
		"--absolute-git-dir",
	]);
	let gitDirectory: string;
	try {
		gitDirectory = await realpath(rawGitDirectory);
	} catch (error) {
		throw new Error(
			"現在 worktree の Git directory を確認できません: " +
				rawGitDirectory +
				": " +
				errorText(error),
		);
	}
	if (!isPathWithin(gitDirectory, indexPath)) {
		throw new Error(
			"明示 index は現在 worktree の Git directory 配下である必要があります: " +
				indexPath,
		);
	}
	return indexPath;
}

function nulSeparatedPaths(output: Uint8Array): Buffer[] {
	const paths: Buffer[] = [];
	let start = 0;
	for (let index = 0; index < output.byteLength; index += 1) {
		if (output[index] === 0) {
			paths.push(Buffer.from(output.subarray(start, index)));
			start = index + 1;
		}
	}
	if (start < output.byteLength)
		paths.push(Buffer.from(output.subarray(start)));
	return paths;
}

function containsPath(paths: Buffer[], expected: DocumentName): boolean {
	const expectedBytes = Buffer.from(expected, "utf8");
	return paths.some((path) => path.equals(expectedBytes));
}

function stagedDocuments(
	repository: string,
	indexFile?: string,
): DocumentName[] {
	let changed: GitResult;
	let indexed: GitResult;
	try {
		changed = git(
			repository,
			["diff", "--cached", "--name-only", "-z"],
			indexFile,
		);
		indexed = git(repository, ["ls-files", "--cached", "-z"], indexFile);
	} catch (error) {
		throw new Error(`Git staged path を取得できません: ${errorText(error)}`);
	}
	if (changed.exitCode !== 0) {
		throw new Error(
			"git diff --cached が失敗しました: " +
				decodeGitText(changed.stderr, "Git error"),
		);
	}
	if (indexed.exitCode !== 0) {
		throw new Error(
			"git ls-files --cached が失敗しました: " +
				decodeGitText(indexed.stderr, "Git error"),
		);
	}

	const changedPaths = nulSeparatedPaths(changed.stdout);
	const indexedPaths = nulSeparatedPaths(indexed.stdout);
	return documentNames.filter(
		(path) =>
			containsPath(changedPaths, path) && containsPath(indexedPaths, path),
	);
}

function stagedBlob(
	repository: string,
	path: DocumentName,
	indexFile?: string,
): Uint8Array {
	let result: GitResult;
	try {
		result = git(repository, ["show", `:${path}`], indexFile);
	} catch (error) {
		throw new Error(`${path} の staged blob を読めません: ${errorText(error)}`);
	}
	if (result.exitCode !== 0) {
		throw new Error(
			path +
				" の staged blob を読めません: " +
				decodeGitText(result.stderr, "Git error"),
		);
	}
	return result.stdout;
}

function showFindings(path: DocumentName, findings: Finding[]): number {
	let errors = 0;
	for (const issue of findings) {
		const kind = issue.kind === "error" ? "error" : "warning";
		const location = issue.line === undefined ? path : `${path}:${issue.line}`;
		console.error(`${kind}: ${location}: ${issue.message}`);
		if (issue.kind === "error") errors += 1;
	}
	return errors;
}

function helpText(): string {
	return [
		"使い方: check-staged-docs [--index-file PATH]",
		"index の repository 直下 TODO.md / CHANGELOG.md を検査します。",
		"--index-file PATH は現在 worktree の Git directory 配下にある通常 file を指定します。",
		"終了値: 0 = 違反なし（warning のみを含む）、1 = 文書違反、2 = 引数・Git・index・読取失敗",
	].join("\n");
}

async function main(): Promise<void> {
	let args: Arguments;
	try {
		args = parseArguments(process.argv.slice(2));
	} catch (error) {
		throw new Error(`${helpText()}\n${errorText(error)}`);
	}
	if (args.help) {
		console.log(helpText());
		return;
	}

	const startingDirectory = process.cwd();
	const repository = await repositoryRoot(startingDirectory);
	const indexFile =
		args.indexPath === undefined
			? undefined
			: await resolveIndexFile(startingDirectory, repository, args.indexPath);
	const targets = stagedDocuments(repository, indexFile);
	let errorCount = 0;
	let warningCount = 0;
	for (const path of targets) {
		const content = stagedBlob(repository, path, indexFile);
		const findings =
			path === "TODO.md" ? inspectTodo(content) : inspectChangelog(content);
		errorCount += showFindings(path, findings);
		warningCount += findings.filter((issue) => issue.kind === "warning").length;
	}

	if (errorCount > 0) {
		console.error(
			"check-staged-docs: " +
				errorCount +
				" error(s), " +
				warningCount +
				" warning(s)",
		);
		process.exitCode = 1;
	} else if (warningCount > 0) {
		console.error(`check-staged-docs: 0 error(s), ${warningCount} warning(s)`);
	}
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error(`error: ${errorText(error)}`);
		process.exitCode = 2;
	});
}
