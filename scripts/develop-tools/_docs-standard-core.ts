export type FindingKind = "error" | "warning";

export interface Finding {
	kind: FindingKind;
	line?: number;
	message: string;
}

export interface ArchivePlan {
	ok: true;
	content: string;
	archivedMonths: string[];
	bytesBefore: number;
	bytesAfter: number;
}

export interface ArchivePlanFailure {
	ok: false;
	message: string;
}

export type ChangelogArchivePlan = ArchivePlan | ArchivePlanFailure;

export const TODO_MAX_BYTES = 24_000;
export const CHANGELOG_MAX_BYTES = 30_000;
export const TODO_ITEM_WARNING_BYTES = 500;
export const CHANGELOG_ARCHIVE_TARGET_PERCENT = 80;

function finding(kind: FindingKind, message: string, line?: number): Finding {
	return line === undefined ? { kind, message } : { kind, line, message };
}

function decodeUtf8(content: Uint8Array): string | undefined {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(content);
	} catch {
		return undefined;
	}
}

function utf8ByteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function itemBodyBytes(lines: string[], start: number, end: number): number {
	let itemEnd = end;
	while (itemEnd > start && trimLineEnding(lines[itemEnd - 1]) === "") {
		itemEnd -= 1;
	}

	let total = 0;
	for (let index = start; index < itemEnd; index += 1) {
		const line =
			index === itemEnd - 1 ? trimLineEnding(lines[index]) : lines[index];
		total += utf8ByteLength(line);
		if (index > start) total += 1;
	}
	return total;
}

function trimStartSpaceTabs(line: string): string {
	return line.replace(/^[ \t]+/, "");
}

export function inspectTodo(content: Uint8Array): Finding[] {
	const text = decodeUtf8(content);
	if (text === undefined) {
		return [finding("error", "文書が UTF-8 ではありません")];
	}

	const findings: Finding[] = [];
	if (content.byteLength > TODO_MAX_BYTES) {
		findings.push(
			finding(
				"error",
				"TODO.md が上限 " +
					TODO_MAX_BYTES +
					" bytes を超えています: " +
					content.byteLength +
					" bytes",
			),
		);
	}

	const lines = text.split("\n");
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const lineNumber = index + 1;
		const trimmed = trimStartSpaceTabs(line);
		if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
			findings.push(
				finding(
					"error",
					"TODO.md に完了済みの - [x] 項目を残せません（未完了だけを置いてください）",
					lineNumber,
				),
			);
		}
		if (!line.startsWith("- ")) continue;

		let end = lines.length;
		for (let next = index + 1; next < lines.length; next += 1) {
			const continuation = lines[next];
			if (
				continuation.startsWith("- ") ||
				trimStartSpaceTabs(continuation).startsWith("#")
			) {
				end = next;
				break;
			}
		}
		const bytes = itemBodyBytes(lines, index, end);
		if (bytes > TODO_ITEM_WARNING_BYTES) {
			findings.push(
				finding(
					"warning",
					"TODO.md の項目が warning 目安 " +
						TODO_ITEM_WARNING_BYTES +
						" bytes を超えています: " +
						bytes +
						" bytes",
					lineNumber,
				),
			);
		}
	}

	return findings;
}

function parseMonthHeading(line: string): string | undefined {
	const normalized = line.replace(/\r+$/, "");
	if (!normalized.startsWith("## ")) return undefined;
	const month = normalized.slice(3);
	if (month.length !== 7 || month[4] !== "-") return undefined;
	for (let index = 0; index < month.length; index += 1) {
		if (
			index !== 4 &&
			(month.charCodeAt(index) < 48 || month.charCodeAt(index) > 57)
		) {
			return undefined;
		}
	}
	const monthNumber = Number(month.slice(5, 7));
	if (monthNumber < 1 || monthNumber > 12) return undefined;
	return month;
}

function isMonthHeading(line: string): boolean {
	return line.startsWith("## ") && parseMonthHeading(line) !== undefined;
}

function isHistoryNote(line: string): boolean {
	const normalized = line.trim().toLowerCase();
	return (
		normalized.startsWith(">") &&
		normalized.includes("git") &&
		(line.includes("履歴") || normalized.includes("history"))
	);
}

function validDate(date: string): boolean {
	if (date.length !== 10 || date[4] !== "-" || date[7] !== "-") {
		return false;
	}
	for (let index = 0; index < date.length; index += 1) {
		if (index !== 4 && index !== 7) {
			const character = date.charCodeAt(index);
			if (character < 48 || character > 57) return false;
		}
	}

	const year = Number(date.slice(0, 4));
	const month = Number(date.slice(5, 7));
	const day = Number(date.slice(8, 10));
	if (year < 1) return false;

	let daysInMonth: number;
	switch (month) {
		case 1:
		case 3:
		case 5:
		case 7:
		case 8:
		case 10:
		case 12:
			daysInMonth = 31;
			break;
		case 4:
		case 6:
		case 9:
		case 11:
			daysInMonth = 30;
			break;
		case 2:
			daysInMonth =
				year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
			break;
		default:
			return false;
	}
	return day >= 1 && day <= daysInMonth;
}

type ChangelogItemResult =
	| { ok: true; date: string }
	| { ok: false; message: string };

function parseChangelogItem(line: string): ChangelogItemResult {
	if (!line.startsWith("- **")) {
		return {
			ok: false,
			message:
				"CHANGELOG.md のトップレベル項目は - **成果（YYYY-MM-DD）**: 要約 の形にしてください",
		};
	}
	const rest = line.slice(4);
	const marker = rest.indexOf("**:");
	if (marker < 0) {
		return {
			ok: false,
			message:
				"CHANGELOG.md のトップレベル項目は - **成果（YYYY-MM-DD）**: 要約 の形にしてください",
		};
	}
	const title = rest.slice(0, marker);
	const summary = rest.slice(marker + 3).trim();
	if (summary.length === 0) {
		return { ok: false, message: "CHANGELOG.md の成果項目には要約が必要です" };
	}

	const opening = title.lastIndexOf("（");
	if (opening < 0) {
		return {
			ok: false,
			message: "CHANGELOG.md の成果項目に全角括弧の日付がありません",
		};
	}
	const achievement = title.slice(0, opening);
	if (achievement.length === 0 || achievement !== achievement.trimEnd()) {
		return {
			ok: false,
			message:
				"CHANGELOG.md の成果タイトルと日付括弧の間に空白を入れず、成果名を記載してください",
		};
	}
	if (!title.endsWith("）")) {
		return {
			ok: false,
			message: "CHANGELOG.md の成果項目の日付括弧が閉じていません",
		};
	}
	const dateAndNote = title.slice(opening + 1, -1);
	const date = dateAndNote.slice(0, 10);
	if (
		!validDate(date) ||
		(dateAndNote.length > 10 &&
			(!dateAndNote.slice(10).startsWith("、") ||
				dateAndNote.slice(11).trim().length === 0))
	) {
		return {
			ok: false,
			message:
				"CHANGELOG.md の成果項目の日付は YYYY-MM-DD（任意の補足）にしてください",
		};
	}
	return { ok: true, date };
}

export function inspectChangelog(content: Uint8Array): Finding[] {
	const text = decodeUtf8(content);
	if (text === undefined) {
		return [finding("error", "文書が UTF-8 ではありません")];
	}

	const findings: Finding[] = [];
	if (content.byteLength > CHANGELOG_MAX_BYTES) {
		findings.push(
			finding(
				"error",
				"CHANGELOG.md が上限 " +
					CHANGELOG_MAX_BYTES +
					" bytes を超えています: " +
					content.byteLength +
					" bytes。archive-changelog を実行してください",
			),
		);
	}

	const lines = text.split("\n");
	const firstLine = lines[0].replace(/\r+$/, "");
	if (!firstLine.startsWith("# Changelog")) {
		findings.push(
			finding(
				"error",
				"CHANGELOG.md の1行目は # Changelog で始めてください",
				1,
			),
		);
	}

	const firstHeading = lines.findIndex((line) => isMonthHeading(line));
	if (firstHeading >= 0) {
		if (!lines.slice(0, firstHeading).some(isHistoryNote)) {
			findings.push(
				finding(
					"error",
					"最初の月見出しより前に、古い分を git 履歴に任せる注記が必要です",
					firstHeading + 1,
				),
			);
		}
	} else {
		findings.push(
			finding("error", "CHANGELOG.md に ## YYYY-MM の月見出しがありません"),
		);
	}

	let currentMonth: string | undefined;
	let previousMonth: string | undefined;
	const itemIndices: number[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const lineNumber = index + 1;
		if (line.startsWith("##") && !line.startsWith("###")) {
			const month = parseMonthHeading(line);
			if (month !== undefined) {
				if (previousMonth !== undefined && previousMonth < month) {
					findings.push(
						finding(
							"error",
							"CHANGELOG.md の月見出しは新しい月から並べてください",
							lineNumber,
						),
					);
				}
				previousMonth = month;
				currentMonth = month;
			} else {
				findings.push(
					finding(
						"error",
						"CHANGELOG.md の見出しは ## YYYY-MM だけにしてください",
						lineNumber,
					),
				);
			}
			continue;
		}
		if (!line.startsWith("- ")) continue;
		itemIndices.push(index);
		if (currentMonth === undefined) {
			findings.push(
				finding(
					"error",
					"CHANGELOG.md の成果項目は月見出しの下に置いてください",
					lineNumber,
				),
			);
			continue;
		}

		const item = parseChangelogItem(line);
		if (!item.ok) {
			findings.push(finding("error", item.message, lineNumber));
		} else if (item.date.slice(0, 7) !== currentMonth) {
			findings.push(
				finding(
					"error",
					`成果項目の日付の年月が見出し ${currentMonth} と一致しません`,
					lineNumber,
				),
			);
		}
	}

	for (let position = 0; position < itemIndices.length; position += 1) {
		const index = itemIndices[position];
		const nextItem = itemIndices[position + 1] ?? lines.length;
		let nextHeading = lines.length;
		for (let scan = index + 1; scan < nextItem; scan += 1) {
			if (lines[scan].startsWith("##") && !lines[scan].startsWith("###")) {
				nextHeading = scan;
				break;
			}
		}
		const bytes = itemBodyBytes(lines, index, Math.min(nextItem, nextHeading));
		if (bytes > TODO_ITEM_WARNING_BYTES) {
			findings.push(
				finding(
					"warning",
					"CHANGELOG.md の項目が warning 目安 " +
						TODO_ITEM_WARNING_BYTES +
						" bytes を超えています: " +
						bytes +
						" bytes",
					index + 1,
				),
			);
		}
	}

	return findings;
}

interface MonthSection {
	month: string;
	raw: string;
}

function splitRecords(content: string): string[] {
	const records: string[] = [];
	let start = 0;
	for (let index = 0; index < content.length; index += 1) {
		if (content[index] === "\n") {
			records.push(content.slice(start, index + 1));
			start = index + 1;
		}
	}
	if (start < content.length) records.push(content.slice(start));
	return records;
}

function trimLineEnding(record: string): string {
	return record.replace(/[\r\n]+$/, "");
}

function parseSections(
	content: string,
):
	| { ok: true; preamble: string; sections: MonthSection[] }
	| { ok: false; message: string } {
	const records = splitRecords(content);
	let first = -1;
	for (let index = 0; index < records.length; index += 1) {
		if (isMonthHeading(trimLineEnding(records[index]))) {
			first = index;
			break;
		}
	}
	if (first < 0) {
		return {
			ok: false,
			message: "CHANGELOG.md に ## YYYY-MM の月見出しがありません",
		};
	}

	const starts: Array<{ index: number; month: string }> = [];
	for (let index = first; index < records.length; index += 1) {
		const line = trimLineEnding(records[index]);
		if (line.startsWith("##") && !line.startsWith("###")) {
			const month = parseMonthHeading(line);
			if (month === undefined) {
				return {
					ok: false,
					message: `CHANGELOG.md の見出しが不正です: ${index + 1}`,
				};
			}
			starts.push({ index, month });
		}
	}

	const sections = starts.map((start, position): MonthSection => {
		const end = starts[position + 1]?.index ?? records.length;
		return {
			month: start.month,
			raw: records.slice(start.index, end).join(""),
		};
	});
	return {
		ok: true,
		preamble: records.slice(0, first).join(""),
		sections,
	};
}

function archivePreamble(
	preamble: string,
	archived: string[],
	commitSha: string,
): string {
	if (archived.length === 0) return preamble;
	const months = [...archived].sort();
	const newestArchived = months[months.length - 1];
	const note =
		"> " +
		newestArchived +
		" 以前は git 履歴（退避直前の commit: " +
		commitSha +
		"）";
	const records = splitRecords(preamble);
	const noteIndex = records.findIndex((record) =>
		isHistoryNote(trimLineEnding(record)),
	);
	if (noteIndex >= 0) {
		const lineEnding = records[noteIndex].endsWith("\r\n") ? "\r\n" : "\n";
		const before = records
			.slice(0, noteIndex)
			.join("")
			.replace(/(?:[ \t]*\r?\n)+$/, "");
		const after = records
			.slice(noteIndex + 1)
			.filter((record) => !isHistoryNote(trimLineEnding(record)))
			.join("")
			.replace(/^(?:[ \t]*\r?\n)+/, "");
		const beforeNote =
			before.length === 0 ? "" : `${before}${lineEnding}${lineEnding}`;
		return `${beforeNote}${note}${lineEnding}${lineEnding}${after}`;
	}
	const withoutTrailingNewlines = preamble.replace(/[\r\n]+$/, "");
	if (withoutTrailingNewlines.length === 0) {
		return `# Changelog\n\n${note}\n\n`;
	}
	return `${withoutTrailingNewlines}\n\n${note}\n\n`;
}

export function planChangelogArchive(
	content: string,
	currentMonth: string,
	commitSha: string,
): ChangelogArchivePlan {
	const bytesBefore = utf8ByteLength(content);
	if (bytesBefore <= CHANGELOG_MAX_BYTES) {
		return {
			ok: true,
			content,
			archivedMonths: [],
			bytesBefore,
			bytesAfter: bytesBefore,
		};
	}

	const parsed = parseSections(content);
	if (!parsed.ok) return { ok: false, message: parsed.message };
	const sections = [...parsed.sections];
	const protectsCurrentMonth = sections.some(
		(section) => section.month === currentMonth,
	);
	const protectedMonth = protectsCurrentMonth
		? currentMonth
		: sections.reduce(
				(latest, section) => (section.month > latest ? section.month : latest),
				sections[0].month,
			);

	const targetBytes = Math.floor(
		(CHANGELOG_MAX_BYTES * CHANGELOG_ARCHIVE_TARGET_PERCENT) / 100,
	);
	const archived: string[] = [];
	while (true) {
		const candidatePreamble = archivePreamble(
			parsed.preamble,
			archived,
			commitSha,
		);
		const candidate =
			candidatePreamble + sections.map((section) => section.raw).join("");
		const bytesAfter = utf8ByteLength(candidate);
		if (bytesAfter <= targetBytes) {
			return {
				ok: true,
				content: candidate,
				archivedMonths: [...archived].sort(),
				bytesBefore,
				bytesAfter,
			};
		}

		let oldestIndex = -1;
		for (let index = 0; index < sections.length; index += 1) {
			if (sections[index].month === protectedMonth) continue;
			if (
				oldestIndex < 0 ||
				sections[index].month < sections[oldestIndex].month
			) {
				oldestIndex = index;
			}
		}
		if (oldestIndex < 0) {
			if (bytesAfter <= CHANGELOG_MAX_BYTES) {
				return {
					ok: true,
					content: candidate,
					archivedMonths: [...archived].sort(),
					bytesBefore,
					bytesAfter,
				};
			}
			return {
				ok: false,
				message: protectsCurrentMonth
					? "古い月をすべて退避しても上限に戻りません。当月の項目を畳む必要があります"
					: "古い月をすべて退避しても上限に戻りません。最新の月の項目を畳む必要があります",
			};
		}
		archived.push(sections[oldestIndex].month);
		sections.splice(oldestIndex, 1);
	}
}
