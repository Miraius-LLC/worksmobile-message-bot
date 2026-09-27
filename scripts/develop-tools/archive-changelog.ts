#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import type { Stats } from "node:fs";
import {
	type FileHandle,
	lstat,
	open,
	readFile,
	rename,
	unlink,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import Bun from "bun";
import {
	CHANGELOG_MAX_BYTES,
	planChangelogArchive,
} from "./_docs-standard-core";

interface GitResult {
	stdout: Buffer;
	stderr: Buffer;
	exitCode: number | null;
}

class CommandFailure extends Error {
	constructor(
		message: string,
		readonly exitCode: number,
	) {
		super(message);
	}
}

function cleanGitEnvironment(): Record<string, string> {
	const environment: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && !key.startsWith("GIT_")) {
			environment[key] = value;
		}
	}
	return environment;
}

function git(cwd: string, args: string[]): GitResult {
	return Bun.spawnSync(["git", ...args], {
		cwd,
		env: cleanGitEnvironment(),
		stdout: "pipe",
		stderr: "pipe",
	});
}

function decodeUtf8(bytes: Uint8Array, label: string): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new CommandFailure(`${label} の出力が UTF-8 ではありません`, 2);
	}
}

function gitText(cwd: string, args: string[]): string {
	let result: GitResult;
	try {
		result = git(cwd, args);
	} catch (error) {
		throw new CommandFailure(
			`git ${args.join(" ")} を起動できません: ${errorText(error)}`,
			2,
		);
	}
	if (result.exitCode !== 0) {
		throw new CommandFailure(
			"git " +
				args.join(" ") +
				" が失敗しました: " +
				decodeUtf8(result.stderr, "Git error"),
			2,
		);
	}
	return decodeUtf8(result.stdout, "Git output").replace(/\r?\n$/, "");
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function parseArguments(args: string[]): { help: boolean; apply: boolean } {
	if (args.some((arg) => arg === "--help" || arg === "-h")) {
		return { help: true, apply: false };
	}
	if (args.some((arg) => arg !== "--yes")) {
		throw new CommandFailure("使い方: archive-changelog [--yes]", 2);
	}
	return { help: false, apply: args.includes("--yes") };
}

function currentLocalMonth(): string {
	const date = new Date();
	return (
		String(date.getFullYear()).padStart(4, "0") +
		"-" +
		String(date.getMonth() + 1).padStart(2, "0")
	);
}

async function readChangelog(path: string): Promise<{
	bytes: Buffer;
	content: string;
	mode: number;
}> {
	let metadata: Stats;
	try {
		metadata = await lstat(path);
	} catch (error) {
		throw new CommandFailure(
			`CHANGELOG.md を確認できません: ${errorText(error)}`,
			2,
		);
	}
	if (!metadata.isFile()) {
		throw new CommandFailure(
			"CHANGELOG.md は通常 file である必要があります",
			2,
		);
	}

	let bytes: Buffer;
	try {
		bytes = await readFile(path);
	} catch (error) {
		throw new CommandFailure(
			`CHANGELOG.md を読めません: ${errorText(error)}`,
			2,
		);
	}
	const content = decodeUtf8(bytes, "CHANGELOG.md");
	return { bytes, content, mode: metadata.mode & 0o777 };
}

async function writeAtomically(
	path: string,
	expectedBytes: Buffer,
	content: string,
	mode: number,
): Promise<void> {
	const directory = dirname(path);
	const temporaryPath = resolve(
		directory,
		"." +
			basename(path) +
			".archive-" +
			process.pid +
			"-" +
			randomBytes(8).toString("hex") +
			".tmp",
	);
	let created = false;
	let renamed = false;
	let file: FileHandle | undefined;
	try {
		file = await open(temporaryPath, "wx", mode);
		created = true;
		await file.writeFile(content, { encoding: "utf8" });
		await file.chmod(mode);
		await file.sync();
		await file.close();
		file = undefined;
		const currentBytes = await readFile(path);
		if (!currentBytes.equals(expectedBytes)) {
			throw new Error("退避計画後に CHANGELOG.md が変更されました");
		}
		await rename(temporaryPath, path);
		renamed = true;
	} catch (error) {
		if (file !== undefined) {
			await file.close().catch(() => undefined);
		}
		if (created && !renamed) {
			await unlink(temporaryPath).catch(() => undefined);
		}
		throw new CommandFailure(
			`CHANGELOG.md を原子的に更新できませんでした: ${errorText(error)}`,
			2,
		);
	}
}

function helpText(): string {
	return [
		"使い方: archive-changelog [--yes]",
		"repository root の CHANGELOG.md を古い月から Git 履歴へ退避します。",
		"既定は変更しない dry-run です。確認後は --yes で反映します。",
		"30,000 byte 以下は変更しません。退避節を別 file へ移しません。",
		"終了値: 0 = dry-run または反映成功、1 = 保護月を残すと上限超過、2 = 入力または Git の失敗",
	].join("\n");
}

async function main(): Promise<void> {
	const args = parseArguments(process.argv.slice(2));
	if (args.help) {
		console.log(helpText());
		return;
	}

	const startingDirectory = process.cwd();
	const repository = gitText(startingDirectory, [
		"rev-parse",
		"--show-toplevel",
	]);
	const changelogPath = resolve(repository, "CHANGELOG.md");
	const changelog = await readChangelog(changelogPath);
	const commitSha = gitText(repository, ["rev-parse", "HEAD"]);
	const plan = planChangelogArchive(
		changelog.content,
		currentLocalMonth(),
		commitSha,
	);
	if (!plan.ok) {
		throw new CommandFailure(plan.message, 1);
	}

	console.log(
		"CHANGELOG.md: " +
			plan.bytesBefore +
			" bytes → " +
			plan.bytesAfter +
			" bytes",
	);
	if (plan.archivedMonths.length === 0) {
		console.log("退避する月: なし（変更不要）");
		return;
	}
	console.log(
		"退避する月: " +
			plan.archivedMonths[0] +
			"〜" +
			plan.archivedMonths[plan.archivedMonths.length - 1],
	);
	console.log(`退避直前の commit: ${commitSha}`);

	if (!args.apply) {
		console.log(
			"dry-run のため CHANGELOG.md は変更していません。反映には --yes を指定してください。",
		);
		return;
	}
	if (plan.content === changelog.content) return;
	if (plan.bytesBefore > CHANGELOG_MAX_BYTES) {
		await writeAtomically(
			changelogPath,
			changelog.bytes,
			plan.content,
			changelog.mode,
		);
	}
	console.log("CHANGELOG.md を更新しました。");
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		if (error instanceof CommandFailure) {
			console.error(`error: ${error.message}`);
			process.exitCode = error.exitCode;
			return;
		}
		console.error(`error: ${errorText(error)}`);
		process.exitCode = 2;
	});
}
