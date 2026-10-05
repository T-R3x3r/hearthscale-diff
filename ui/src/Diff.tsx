/**
 * The Diff view: a patch read out of a repository the person gave the app,
 * in one of the three scopes `git` answers, with the branches a comparison
 * may use. The picker offers the repositories in the folders the person
 * gave the app, and the pick of another. Rows a person comments on become
 * chips on the chats on screen, which the next message there carries; a
 * comment whose rows moved in a fresh read is let go.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DiffView, parsePatch } from './DiffView.tsx';
import { wordsOf, type DiffSource, type Host, type Patch, type Refs, type Repo } from './host.ts';
import { Icon, MDivider, MItem, StripButton } from './kit.tsx';
import { commentOn, reviewBlock, survives, type ReviewComment } from './review.ts';

const SCOPE_LABEL: Record<DiffSource['scope'], string> = {
  working: 'Working tree',
  staged: 'Staged',
  branch: 'Compared with',
};

function scopeLabel(source: DiffSource): string {
  return source.scope === 'branch'
    ? `${SCOPE_LABEL.branch} ${source.base}`
    : SCOPE_LABEL[source.scope];
}

/** A path's last segment. */
const baseName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

/** The changed files a patch leaves out, in words. */
function hiddenWords(count: number): string {
  return count === 1
    ? '1 changed file is not shown: it is in a folder that holds credentials or another program’s secrets.'
    : `${count} changed files are not shown: they are in folders that hold credentials or another program’s secrets.`;
}

/** A sentence in the middle of the view: an empty state, or why there is
 *  nothing to read. */
function DiffNote({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="hs-rview hs-panel-refusal">
      <div className="hs-panel-refusal-content">
        <Icon name="git-branch-line" size={20} className="hs-panel-muted-icon" />
        <span className="hs-panel-refusal-text">{text}</span>
        {children}
      </div>
    </div>
  );
}

function BarChoice({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className={`hs-hovbox-ink hs-inkmut hs-panel-picker${open ? ' hs-boxsel' : ''}`}
    >
      <span className="hs-panel-branch-name">{label}</span>
      <Icon name="arrow-down-s-line" size={10} className="hs-panel-fixed-icon" />
    </span>
  );
}

/** A comment as the chip that carries it. */
const blockOf = (comment: ReviewComment) => ({
  type: 'text',
  text: reviewBlock(comment),
  _meta: { 'openai/title': `${baseName(comment.file)} ${comment.range}` },
});

export function Diff({ host }: { host: Host }) {
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffSource | null>(null);
  const [read, setRead] = useState<Patch | { error: string } | null>(null);
  const [refs, setRefs] = useState<Refs | null>(null);
  const [menu, setMenu] = useState<'repo' | 'scope' | null>(null);
  const [asked, setAsked] = useState(0);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const held = useRef(comments);
  held.current = comments;

  /** The comments the chats hold, which the view's context becomes. */
  const keep = (next: ReviewComment[]) => {
    setComments(next);
    void host.context(next.map(blockOf));
  };

  // A chip the person removed, or a message that took the chips, lets
  // the comment go.
  useEffect(
    () =>
      host.onHeld(() => {
        const texts = new Set(host.held().map((block) => block.text));
        setComments((all) => all.filter((c) => texts.has(reviewBlock(c))));
      }),
    [host],
  );

  useEffect(() => {
    let live = true;
    void host.repos().then(
      (list) => {
        if (!live) return;
        setRepos(list);
        setRepoError(null);
      },
      (e: unknown) => live && setRepoError(wordsOf(e)),
    );
    return () => {
      live = false;
    };
  }, [host, asked]);

  // The view reads the first repository the picker offers until the
  // person picks another.
  useEffect(() => {
    const first = repos?.[0];
    if (first && (!diff || !repos.some((r) => r.root === diff.root))) {
      setDiff({ root: first.root, scope: 'working' });
    }
  }, [repos]);

  const key = diff ? [diff.root, diff.scope, diff.base ?? ''].join('\0') : '';
  useEffect(() => {
    if (!diff) return;
    let live = true;
    setRead(null);
    void host.diff(diff).then(
      (answer) => {
        if (!live) return;
        setRead(answer);
        const kept = held.current.filter((c) => survives(answer.patch, diff, c));
        if (kept.length !== held.current.length) keep(kept);
      },
      (e: unknown) => live && setRead({ error: wordsOf(e) }),
    );
    return () => {
      live = false;
    };
  }, [key, asked]);

  useEffect(() => {
    if (!diff) return;
    let live = true;
    void host.refs(diff.root).then(
      (answer) => live && setRefs(answer),
      () => live && setRefs(null),
    );
    return () => {
      live = false;
    };
  }, [diff?.root, asked]);

  const pick = async () => {
    setMenu(null);
    if (await host.pick()) setAsked((n) => n + 1);
  };

  /** An unmodified run's text: the file as the scope's new side holds it,
   *  which only the working scope reads from the working tree. */
  const loadFile = (path: string): Promise<string> => host.file(diff!, path);

  const patch = read && 'patch' in read ? read : null;
  const parsed = patch ? parsePatch(patch.patch) : null;
  const shown = parsed?.kind === 'files' ? parsed.files.length : 0;

  if (repos === null && repoError === null) return null;

  return (
    <div className="hs-rview hs-changes-view">
      {diff && (
        <div className="hs-changes-toolbar">
          <span className="hs-browser-menu-anchor">
            <BarChoice
              label={baseName(diff.root)}
              open={menu === 'repo'}
              onClick={() => setMenu(menu === 'repo' ? null : 'repo')}
            />
            {menu === 'repo' && (
              <div className="hs-panel-picker-popover" onMouseLeave={() => setMenu(null)}>
                <div className="hs-menu hs-panel-menu hs-panel-action-menu">
                  {(repos ?? []).map((repo) => (
                    <MItem
                      key={repo.root}
                      label={baseName(repo.root)}
                      sub={repo.branch || repo.root}
                      selected={repo.root === diff.root}
                      onClick={() => {
                        setMenu(null);
                        setDiff({
                          root: repo.root,
                          scope: diff.scope,
                          ...(diff.base && { base: diff.base }),
                        });
                      }}
                    />
                  ))}
                  <MDivider />
                  <MItem
                    icon={<Icon name="folder-open-line" size={14} />}
                    label="Choose a repository"
                    onClick={() => void pick()}
                  />
                </div>
              </div>
            )}
          </span>
          <span className="hs-browser-menu-anchor">
            <BarChoice
              label={scopeLabel(diff)}
              open={menu === 'scope'}
              onClick={() => setMenu(menu === 'scope' ? null : 'scope')}
            />
            {menu === 'scope' && (
              <div className="hs-panel-picker-popover" onMouseLeave={() => setMenu(null)}>
                <div className="hs-menu hs-panel-menu hs-panel-action-menu">
                  <MItem
                    label={SCOPE_LABEL.working}
                    selected={diff.scope === 'working'}
                    onClick={() => {
                      setMenu(null);
                      setDiff({ root: diff.root, scope: 'working' });
                    }}
                  />
                  <MItem
                    label={SCOPE_LABEL.staged}
                    selected={diff.scope === 'staged'}
                    onClick={() => {
                      setMenu(null);
                      setDiff({ root: diff.root, scope: 'staged' });
                    }}
                  />
                  <MDivider />
                  {(refs?.branches ?? []).map((branch) => (
                    <MItem
                      key={branch}
                      label={`${SCOPE_LABEL.branch} ${branch}`}
                      selected={diff.scope === 'branch' && diff.base === branch}
                      disabled={branch === refs?.current}
                      onClick={() => {
                        setMenu(null);
                        setDiff({ root: diff.root, scope: 'branch', base: branch });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </span>
          <span className="hs-flex-spacer" />
          <StripButton onClick={() => setAsked((n) => n + 1)}>
            <Icon name="refresh-line" size={13} />
          </StripButton>
        </div>
      )}
      {!diff ? (
        <DiffNote
          text={
            repoError ??
            'No repository here yet. Grant a folder that is a git repository to read its changes.'
          }
        >
          <button
            type="button"
            className="hs-button"
            data-variant="secondary"
            data-size="sm"
            onClick={() => void pick()}
          >
            <Icon name="folder-open-line" size={14} />
            Choose a repository
          </button>
        </DiffNote>
      ) : read === null ? null : 'error' in read ? (
        <DiffNote text={read.error} />
      ) : read.patch.trim() === '' ? (
        <DiffNote
          text={read.hidden > 0 ? hiddenWords(read.hidden) : 'Nothing has changed here yet.'}
        />
      ) : (
        <>
          {read.truncated && (
            <span className="hs-panel-warning">
              This patch is larger than the viewer reads. Showing the first {shown}{' '}
              {shown === 1 ? 'file' : 'files'}.
            </span>
          )}
          {read.hidden > 0 && <span className="hs-panel-warning">{hiddenWords(read.hidden)}</span>}
          <DiffView
            patch={read.patch}
            loadFile={loadFile}
            onComment={(selection) => {
              const made = commentOn(diff.root, scopeLabel(diff), selection);
              const same = (c: ReviewComment) =>
                c.root === made.root && c.file === made.file && c.range === made.range;
              keep([...comments.filter((c) => !same(c)), made]);
            }}
          />
        </>
      )}
    </div>
  );
}
