/**
 * A review comment: a run of diff rows a person quoted in the view, held
 * as a chip on the chats on screen until the next message there carries
 * it. The block that rides the message is the tag, then the fenced
 * excerpt; the words the person typed ride beside the blocks, because one
 * message can answer several of them.
 */
import { parsePatch, type DiffLine, type DiffSelection } from './DiffView.tsx';

export interface ReviewComment {
  /** The repository the patch was read in, and the path that patch names. */
  root: string;
  file: string;
  /** The scope the patch was read at, in the words the toolbar showed. */
  section: string;
  header: string;
  /** The first quoted row's number in each gutter: the anchor a re-read
   *  looks for. */
  oldNo?: number;
  newNo?: number;
  /** The quoted run as the block names it, `L120-L124`. */
  range: string;
  /** The quoted rows, sign and all. */
  lines: string[];
}

/** One row as a patch writes it. */
function signed(line: DiffLine): string {
  return `${line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}${line.text}`;
}

/** The number a row is addressed by: the new side where it has one, and
 *  the old side for a removed row. */
function lineNo(line: DiffLine): number {
  return line.newNo ?? line.oldNo ?? 0;
}

export function commentOn(root: string, section: string, selection: DiffSelection): ReviewComment {
  const first = selection.lines[0]!;
  const last = selection.lines[selection.lines.length - 1]!;
  return {
    root,
    file: selection.file.path,
    section,
    header: selection.header,
    ...(first.oldNo !== undefined && { oldNo: first.oldNo }),
    ...(first.newNo !== undefined && { newNo: first.newNo }),
    range: `L${lineNo(first)}-L${lineNo(last)}`,
    lines: selection.lines.map(signed),
  };
}

/** The block that rides the prompt. */
export function reviewBlock(comment: ReviewComment): string {
  return [
    `<review_comment file="${comment.file}" range="${comment.range}" section="${comment.section}">`,
    '```diff',
    comment.header,
    ...comment.lines,
    '```',
    '</review_comment>',
  ].join('\n');
}

/** Whether a freshly read patch still holds the rows a comment quotes, at
 *  the numbers it was made on. */
function stillAnchored(patch: string, comment: ReviewComment): boolean {
  const parsed = parsePatch(patch);
  if (parsed.kind !== 'files') return false;
  const file = parsed.files.find((each) => each.path === comment.file);
  if (!file) return false;
  const rows = file.hunks.flatMap((hunk) => hunk.lines);
  const at = rows.findIndex((row) => row.oldNo === comment.oldNo && row.newNo === comment.newNo);
  if (at === -1) return false;
  const last = rows[at + comment.lines.length - 1];
  if (!last || `L${lineNo(rows[at]!)}-L${lineNo(last)}` !== comment.range) return false;
  return comment.lines.every((line, n) => {
    const row = rows[at + n];
    return row !== undefined && signed(row) === line;
  });
}

/** Whether a comment survives a freshly read patch. One made in another
 *  repository, or on a file this patch was narrowed away from, is none of
 *  this patch's business; every other one must still find its anchor, and
 *  one whose rows moved is dropped, never re-pointed. */
export function survives(
  patch: string,
  source: { root: string; paths?: string[] },
  comment: ReviewComment,
): boolean {
  if (comment.root !== source.root) return true;
  if (source.paths?.length && !source.paths.includes(comment.file)) return true;
  return stillAnchored(patch, comment);
}
