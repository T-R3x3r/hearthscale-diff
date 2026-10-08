/**
 * The patch parser and the diff view.
 *
 * `parsePatch` reads a unified patch into files, hunks and lines. A patch it
 * does not understand comes back as the `raw` arm carrying the reason, which
 * the view shows on its header above the text — a patch is never dropped and
 * never guessed at.
 *
 * `<DiffView>` draws unified rows only: two gutters, a sticky header per
 * file, collapse from that header and from the toolbar, "N unmodified
 * lines" runs that expand in place, and a run of a hunk's own rows the user
 * selects to comment on. Rows are windowed per file with the same
 * prefix-sum recipe the sidebar and the file tree use, over the same height
 * constants the rows are painted at, so the scroll range and the rendered
 * geometry are one number.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './kit.tsx';

export interface DiffLine {
  kind: 'add' | 'del' | 'ctx';
  text: string;
  oldNo?: number;
  newNo?: number;
}

export interface Hunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface PatchFile {
  path: string;
  /** Where a renamed file came from. */
  oldPath?: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  hunks: Hunk[];
}

export type ParsedPatch =
  { kind: 'files'; files: PatchFile[] } | { kind: 'raw'; text: string; reason: string };

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** A path as a patch header writes it: the `a/` or `b/` prefix off, and a
 *  tab-separated timestamp behind it dropped. */
function bare(path: string): string {
  const tab = path.indexOf('\t');
  return (tab === -1 ? path : path.slice(0, tab)).replace(/^[ab]\//, '');
}

const started = (path: string): PatchFile => ({
  path,
  status: 'modified',
  additions: 0,
  deletions: 0,
  hunks: [],
});

function read(text: string): ParsedPatch {
  const give = (reason: string): ParsedPatch => ({ kind: 'raw', text, reason });
  const lines = text.split('\n');
  const files: PatchFile[] = [];
  let hunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let oldLeft = 0;
  let newLeft = 0;

  for (const [i, line] of lines.entries()) {
    let file = files[files.length - 1];

    if (hunk && (oldLeft > 0 || newLeft > 0)) {
      const body = line.slice(1);
      if (line.startsWith('\\')) continue;
      if (line.startsWith('+')) {
        if (newLeft === 0) return give('A hunk holds more added lines than its header counts.');
        newLeft--;
        hunk.lines.push({ kind: 'add', text: body, newNo: newNo++ });
      } else if (line.startsWith('-')) {
        if (oldLeft === 0) return give('A hunk holds more removed lines than its header counts.');
        oldLeft--;
        hunk.lines.push({ kind: 'del', text: body, oldNo: oldNo++ });
      } else if (line.startsWith(' ') || line === '') {
        // The split leaves an empty last element for the patch's own final
        // newline, which is not a context line.
        if (line === '' && i === lines.length - 1) continue;
        if (oldLeft === 0 || newLeft === 0)
          return give('A hunk holds more context lines than its header counts.');
        oldLeft--;
        newLeft--;
        hunk.lines.push({ kind: 'ctx', text: body, oldNo: oldNo++, newNo: newNo++ });
      } else {
        return give('A line inside a hunk does not start with a diff marker.');
      }
      continue;
    }
    hunk = null;

    const head = HUNK_HEADER.exec(line);
    if (head) {
      if (!file) return give('A hunk appears before any file header.');
      oldNo = Number(head[1]);
      newNo = Number(head[3]);
      oldLeft = head[2] === undefined ? 1 : Number(head[2]);
      newLeft = head[4] === undefined ? 1 : Number(head[4]);
      hunk = { header: line, oldStart: oldNo, newStart: newNo, lines: [] };
      file.hunks.push(hunk);
      continue;
    }

    if (line.startsWith('diff --git ')) {
      const pair = /^diff --git (.+) (.+)$/.exec(line);
      if (!pair?.[2]) return give('A `diff --git` header does not name two paths.');
      files.push(started(bare(pair[2])));
      continue;
    }
    if (line.startsWith('--- ')) {
      const path = bare(line.slice(4));
      if (!file || file.hunks.length > 0) {
        file = started(path);
        files.push(file);
      }
      if (path === '/dev/null') file.status = 'added';
      else file.oldPath = path;
      continue;
    }
    if (!file) continue;
    if (line.startsWith('+++ ')) {
      const path = bare(line.slice(4));
      if (path === '/dev/null') file.status = 'deleted';
      else file.path = path;
    } else if (line.startsWith('new file mode ')) file.status = 'added';
    else if (line.startsWith('deleted file mode ')) file.status = 'deleted';
    else if (line.startsWith('rename from ')) file.oldPath = line.slice(12);
    else if (line.startsWith('rename to ')) file.path = line.slice(10);
  }

  if (files.length === 0) return give('Nothing here names a file: this is not a unified patch.');

  for (const file of files) {
    if (file.oldPath === file.path || file.oldPath === '/dev/null') delete file.oldPath;
    else if (file.oldPath && file.status === 'modified') file.status = 'renamed';
    for (const each of file.hunks)
      for (const line of each.lines) {
        if (line.kind === 'add') file.additions++;
        if (line.kind === 'del') file.deletions++;
      }
  }
  return { kind: 'files', files };
}

/** The last few patches read, keyed by their own text, so a re-render over an
 *  unchanged patch hands back the same result without reading it again. */
const PARSED = new Map<string, ParsedPatch>();
const PARSED_KEPT = 3;

export function parsePatch(text: string): ParsedPatch {
  const held = PARSED.get(text);
  if (held) return held;
  const parsed = read(text);
  const oldest = PARSED.keys().next().value;
  if (PARSED.size >= PARSED_KEPT && oldest !== undefined) PARSED.delete(oldest);
  PARSED.set(text, parsed);
  return parsed;
}

/** The height every row is measured at and painted at. */
const LINE_H = 20;
const GAP_H = 26;
const FILE_H = 34;
const OVERSCAN = 12;
/** The width of one line-number gutter. */
const GUTTER = 44;

type Row =
  /** `at` is the row's place among its file's hunk lines, and `header` the
   *  hunk it sits under; a row expanded out of an unmodified run belongs to
   *  no hunk and carries neither, which is what keeps a comment quoting the
   *  patch alone. */
  | { kind: 'line'; line: DiffLine; at?: number; header?: string }
  /** An unmodified run before the hunk at `at`, starting at line `oldNo` of
   *  the old file and `newNo` of the new one. `refused` is why its text
   *  would not load. */
  | {
      kind: 'gap';
      at: number;
      count: number;
      header: string;
      oldNo: number;
      newNo: number;
      refused?: string;
    };

/** The expanded lines of a run, or the reason the file would not load. */
type Run = DiffLine[] | string;

const runKey = (path: string, at: number) => `${path}\0${at}`;

/** The rows of one file that reach the band `from`–`to` of its own body,
 *  with the overscan either side. `tops` holds the offset of every row and
 *  the body's own height last. */
function bandOf(tops: number[], rows: number, from: number, to: number) {
  let first = 0;
  while (first < rows && (tops[first + 1] ?? 0) < from) first++;
  let last = first;
  while (last < rows && (tops[last] ?? 0) < to) last++;
  return { first: Math.max(0, first - OVERSCAN), last: Math.min(rows, last + OVERSCAN) };
}

function rowsOf(file: PatchFile, runs: Map<string, Run>): Row[] {
  const rows: Row[] = [];
  let oldNext = 1;
  let newNext = 1;
  let nth = 0;
  file.hunks.forEach((hunk, at) => {
    const count = Math.max(hunk.oldStart - oldNext, hunk.newStart - newNext);
    const run = runs.get(runKey(file.path, at));
    if (Array.isArray(run)) for (const line of run) rows.push({ kind: 'line', line });
    else if (count > 0)
      rows.push({
        kind: 'gap',
        at,
        count,
        header: hunk.header,
        oldNo: oldNext,
        newNo: newNext,
        ...(run === undefined ? {} : { refused: run }),
      });
    for (const line of hunk.lines)
      rows.push({ kind: 'line', line, at: nth++, header: hunk.header });
    oldNext = hunk.oldStart + hunk.lines.filter((line) => line.kind !== 'add').length;
    newNext = hunk.newStart + hunk.lines.filter((line) => line.kind !== 'del').length;
  });
  return rows;
}

/** A run of one file's hunk rows, as the user selected them. */
export interface DiffSelection {
  file: PatchFile;
  /** The hunk header the first selected row sits under. */
  header: string;
  lines: DiffLine[];
}

export interface DiffViewProps {
  /** A unified patch, as `git diff` writes it. */
  patch: string;
  /** A file of the patch, as it names it, scrolled to the top once its
   *  rows exist; `onFocused` hears that the view took it. */
  focus?: string;
  onFocused?: () => void;
  /** The whole text of the file at `path`, so an unmodified run can be
   *  expanded in place. */
  loadFile: (path: string) => Promise<string>;
  /** Takes the selected rows. Without it the rows do not select: a view
   *  nobody can comment through offers no selection. */
  onComment?: (selection: DiffSelection) => void;
}

/**
 * A patch, read. Unified rows only; split view, word wrap and syntax
 * colouring are not drawn here.
 */
export function DiffView({ patch, focus, onFocused, loadFile, onComment }: DiffViewProps) {
  const parsed = useMemo(() => parsePatch(patch), [patch]);
  const [runs, setRuns] = useState<Map<string, Run>>(new Map());
  const [shut, setShut] = useState<Set<string>>(new Set());
  /** The selected run, in one file, by the place of its first and last row
   *  among that file's hunk lines. */
  const [pick, setPick] = useState<{ path: string; from: number; to: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 0 });

  useEffect(() => {
    setRuns(new Map());
    setShut(new Set());
    setPick(null);
  }, [patch]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // A scroll fires far faster than the window moves, so an unchanged band
    // hands back the same object and React drops the render.
    const measure = () =>
      setView((was) =>
        was.top === el.scrollTop && was.height === el.clientHeight
          ? was
          : { top: el.scrollTop, height: el.clientHeight },
      );
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const sizes = new ResizeObserver(measure);
    sizes.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      sizes.disconnect();
    };
  }, [parsed]);

  const groups = useMemo(() => {
    if (parsed.kind !== 'files') return [];
    let top = 0;
    return parsed.files.map((file) => {
      const rows = shut.has(file.path) ? [] : rowsOf(file, runs);
      const tops = [0];
      let body = 0;
      for (const row of rows) {
        body += row.kind === 'gap' ? GAP_H : LINE_H;
        tops.push(body);
      }
      const at = top;
      top += FILE_H + body;
      return { file, rows, tops, body, top: at };
    });
  }, [parsed, runs, shut]);

  useEffect(() => {
    if (focus === undefined) return;
    const group = groups.find((g) => g.file.path.toLowerCase() === focus.toLowerCase());
    if (group && box.current) box.current.scrollTop = group.top;
    onFocused?.();
  }, [focus, groups]);

  const expand = (file: PatchFile, row: Extract<Row, { kind: 'gap' }>) => {
    const key = runKey(file.path, row.at);
    void loadFile(file.path).then(
      (text) => {
        const all = text.split('\n');
        const lines: DiffLine[] = [];
        for (let n = 0; n < row.count; n++)
          lines.push({
            kind: 'ctx',
            text: all[row.newNo - 1 + n] ?? '',
            oldNo: row.oldNo + n,
            newNo: row.newNo + n,
          });
        setRuns((was) => new Map(was).set(key, lines));
      },
      (error: unknown) =>
        setRuns((was) =>
          new Map(was).set(key, error instanceof Error ? error.message : String(error)),
        ),
    );
  };

  const files = parsed.kind === 'files' ? parsed.files : [];
  const allShut = files.length > 0 && shut.size === files.length;
  const picked = pick ? Math.abs(pick.to - pick.from) + 1 : 0;

  const comment = () => {
    const file = files.find((each) => each.path === pick?.path);
    if (!pick || !file || !onComment) return;
    const from = Math.min(pick.from, pick.to);
    const to = Math.max(pick.from, pick.to);
    // The run is quoted under the header of the hunk its first row sits
    // in, which is the one place a reader can put the excerpt back.
    const lines: DiffLine[] = [];
    let header = '';
    for (const hunk of file.hunks) {
      if (!header && from < lines.length + hunk.lines.length) header = hunk.header;
      lines.push(...hunk.lines);
    }
    onComment({ file, header, lines: lines.slice(from, to + 1) });
    setPick(null);
  };

  /** A click selects one row; a shift-click stretches the run to it, and a
   *  run never leaves the file it started in. */
  const select = (path: string, at: number, extend: boolean) =>
    setPick((was) =>
      extend && was?.path === path ? { ...was, to: at } : { path, from: at, to: at },
    );

  return (
    <div
      className="hs-diff"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div className="hs-diff-bar">
        {parsed.kind === 'raw' ? (
          <span className="hs-diff-reason">{parsed.reason}</span>
        ) : (
          <>
            <span>
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
            <Counts
              additions={files.reduce((sum, file) => sum + file.additions, 0)}
              deletions={files.reduce((sum, file) => sum + file.deletions, 0)}
            />
            <span style={{ flex: 1 }} />
            {picked > 0 && onComment && (
              <>
                <span className="hs-diff-picked">
                  {picked} {picked === 1 ? 'line' : 'lines'}
                </span>
                <span className="hs-hovbox-ink hs-diff-act" onClick={comment}>
                  Comment
                </span>
              </>
            )}
            <span
              className="hs-hovbox-ink hs-diff-act"
              onClick={() => setShut(allShut ? new Set() : new Set(files.map((f) => f.path)))}
            >
              {allShut ? 'Expand all' : 'Collapse all'}
            </span>
          </>
        )}
      </div>

      {parsed.kind === 'raw' ? (
        <pre className="hs-scroll hs-diff-raw">{parsed.text}</pre>
      ) : (
        <div ref={box} className="hs-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div style={{ minWidth: 'max-content' }}>
            {groups.map((group) => {
              const from = view.top - (group.top + FILE_H);
              const { first, last } = bandOf(
                group.tops,
                group.rows.length,
                from,
                from + view.height,
              );
              const file = group.file;
              return (
                <div key={file.path} style={{ position: 'relative' }}>
                  <div
                    className="hs-diff-file"
                    onClick={() =>
                      setShut((was) => {
                        const next = new Set(was);
                        if (!next.delete(file.path)) next.add(file.path);
                        return next;
                      })
                    }
                  >
                    <Icon
                      name={shut.has(file.path) ? 'arrow-right-s-line' : 'arrow-down-s-line'}
                      size={14}
                      className="hs-diff-chevron"
                    />
                    <span className="hs-diff-path">
                      {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                    </span>
                    {STATUS[file.status] && (
                      <span className="hs-diff-status">{STATUS[file.status]}</span>
                    )}
                    <Counts additions={file.additions} deletions={file.deletions} />
                  </div>
                  {first > 0 && <div style={{ height: group.tops[first] ?? 0 }} />}
                  {group.rows.slice(first, last).map((row, at) =>
                    row.kind === 'gap' ? (
                      <div
                        key={`gap-${row.at}`}
                        className="hs-diff-gap"
                        onClick={() => expand(file, row)}
                      >
                        <span style={{ width: GUTTER * 2, flex: 'none' }} />
                        <span style={{ flex: 'none' }}>
                          {row.refused ??
                            `${row.count} unmodified ${row.count === 1 ? 'line' : 'lines'}`}
                        </span>
                        <span className="hs-diff-hunk">{row.header}</span>
                      </div>
                    ) : (
                      <div
                        key={`${first + at}`}
                        className="hs-diff-row"
                        data-kind={row.line.kind}
                        data-sel={
                          pick?.path === file.path &&
                          row.at !== undefined &&
                          row.at >= Math.min(pick.from, pick.to) &&
                          row.at <= Math.max(pick.from, pick.to)
                            ? '1'
                            : '0'
                        }
                        onMouseDown={
                          onComment && row.at !== undefined
                            ? (e) => {
                                // A shift-click would otherwise paint the
                                // browser's own text selection over the run.
                                if (e.shiftKey) e.preventDefault();
                                select(file.path, row.at!, e.shiftKey);
                              }
                            : undefined
                        }
                        style={
                          onComment && row.at !== undefined ? { cursor: 'pointer' } : undefined
                        }
                      >
                        <span className="hs-diff-no" style={{ width: GUTTER }}>
                          {row.line.oldNo ?? ''}
                        </span>
                        <span className="hs-diff-no" style={{ width: GUTTER }}>
                          {row.line.newNo ?? ''}
                        </span>
                        <span className="hs-diff-sign">{SIGN[row.line.kind]}</span>
                        <span className="hs-diff-text">{row.line.text}</span>
                      </div>
                    ),
                  )}
                  {last < group.rows.length && (
                    <div style={{ height: group.body - (group.tops[last] ?? 0) }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS: Record<PatchFile['status'], string> = {
  added: 'added',
  deleted: 'deleted',
  modified: '',
  renamed: 'renamed',
};

const SIGN: Record<DiffLine['kind'], string> = { add: '+', del: '−', ctx: ' ' };

function Counts({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="hs-diff-counts">
      <span className="hs-diff-count" data-kind="add">
        +{additions}
      </span>
      <span className="hs-diff-count" data-kind="del">
        −{deletions}
      </span>
    </span>
  );
}
