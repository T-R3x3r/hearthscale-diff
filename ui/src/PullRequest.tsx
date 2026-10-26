/**
 * The pull-request view: the current branch of a repository the person
 * gave the app, as a pull request into a base branch reads it. The commits
 * the base does not hold stand in a list, newest first, under the change
 * of the whole branch from where it parted from the base; a press on one
 * shows that commit's own change. Rows a person comments on become chips
 * on the chats on screen, as in the Diff view.
 */
import { useEffect, useState } from 'react';
import { DiffView } from './DiffView.tsx';
import { useLook, useReview } from './hooks.ts';
import {
  wordsOf,
  type DiffSource,
  type Host,
  type Log,
  type Patch,
  type Refs,
  type Repo,
} from './host.ts';
import {
  BarChoice,
  DiffNote,
  Icon,
  ListPress,
  MDivider,
  MItem,
  PickerList,
  StripButton,
} from './kit.tsx';
import { baseName, commentOn, scopeLabel } from './review.ts';

/** The base a pull request goes into before the person picks one: `main`
 *  or `master` where the repository has one, else the newest other
 *  branch. */
function baseOf(refs: Refs): string | null {
  const others = refs.branches.filter((b) => b !== refs.current);
  return others.find((b) => b === 'main' || b === 'master') ?? others[0] ?? null;
}

/** A commit's date in the words of the person's locale. */
const dayOf = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function Pull({ host }: { host: Host }) {
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [root, setRoot] = useState<string | null>(null);
  const [refs, setRefs] = useState<Refs | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [log, setLog] = useState<Log | { error: string } | null>(null);
  /** The commit whose change shows; null for the whole branch's. */
  const [commit, setCommit] = useState<string | null>(null);
  const [read, setRead] = useState<Patch | { error: string } | null>(null);
  const [menu, setMenu] = useState<{ kind: 'repo' | 'base'; trigger: HTMLElement } | null>(null);
  const [asked, setAsked] = useState(0);
  const review = useReview(host);
  const [look, setLook] = useLook(host);

  useEffect(() => {
    let live = true;
    void host.repos().then(
      (list) => {
        if (!live) return;
        setRepos(list);
        setRepoError(null);
        setRoot((was) => (was && list.some((r) => r.root === was) ? was : (list[0]?.root ?? null)));
      },
      (e: unknown) => live && setRepoError(wordsOf(e)),
    );
    return () => {
      live = false;
    };
  }, [host, asked]);

  useEffect(() => {
    if (!root) return;
    let live = true;
    void host.refs(root).then(
      (answer) => {
        if (!live) return;
        setRefs(answer);
        setBase((was) => (was && answer.branches.includes(was) ? was : baseOf(answer)));
      },
      (e: unknown) => live && setLog({ error: wordsOf(e) }),
    );
    return () => {
      live = false;
    };
  }, [root, asked]);

  useEffect(() => {
    if (!root || !base) return;
    let live = true;
    setLog(null);
    void host.log(root, base).then(
      (answer) => {
        if (!live) return;
        setLog(answer);
        setCommit((was) => (was && answer.commits.some((c) => c.sha === was) ? was : null));
      },
      (e: unknown) => live && setLog({ error: wordsOf(e) }),
    );
    return () => {
      live = false;
    };
  }, [root, base, asked]);

  const source: DiffSource | null =
    root && base
      ? commit
        ? { root, scope: 'commit', commit }
        : { root, scope: 'branch', base }
      : null;
  const key = source ? [source.root, source.scope, source.base, source.commit].join('\0') : '';
  useEffect(() => {
    if (!source) return;
    let live = true;
    setRead(null);
    void host.diff(source).then(
      (answer) => {
        if (!live) return;
        setRead(answer);
        review.prune(answer.patch, source);
      },
      (e: unknown) => live && setRead({ error: wordsOf(e) }),
    );
    return () => {
      live = false;
    };
  }, [key, asked]);

  const pick = async () => {
    setMenu(null);
    if (await host.pick()) setAsked((n) => n + 1);
  };

  if (repos === null && repoError === null) return null;
  const current = refs?.current || 'HEAD';
  const commits = log && 'commits' in log ? log : null;

  return (
    <div className="hs-rview hs-changes-view">
      {root && (
        <div className="hs-changes-toolbar">
          <span className="hs-browser-menu-anchor">
            <BarChoice
              label={baseName(root)}
              open={menu?.kind === 'repo'}
              onClick={(e) =>
                setMenu(menu?.kind === 'repo' ? null : { kind: 'repo', trigger: e.currentTarget })
              }
            />
            {menu?.kind === 'repo' && (
              <PickerList trigger={menu.trigger} onLeave={() => setMenu(null)}>
                {(repos ?? []).map((repo) => (
                  <MItem
                    key={repo.root}
                    label={baseName(repo.root)}
                    sub={repo.branch || repo.root}
                    selected={repo.root === root}
                    onClick={() => {
                      setMenu(null);
                      setRoot(repo.root);
                      setCommit(null);
                    }}
                  />
                ))}
                <MDivider />
                <MItem
                  icon={<Icon name="folder-open-line" size={14} />}
                  label="Choose a repository"
                  onClick={() => void pick()}
                />
              </PickerList>
            )}
          </span>
          {base && (
            <span className="hs-browser-menu-anchor">
              <BarChoice
                label={`${current} into ${base}`}
                open={menu?.kind === 'base'}
                onClick={(e) =>
                  setMenu(menu?.kind === 'base' ? null : { kind: 'base', trigger: e.currentTarget })
                }
              />
              {menu?.kind === 'base' && (
                <PickerList trigger={menu.trigger} onLeave={() => setMenu(null)}>
                  {(refs?.branches ?? []).map((branch) => (
                    <MItem
                      key={branch}
                      label={`Into ${branch}`}
                      selected={branch === base}
                      disabled={branch === refs?.current}
                      onClick={() => {
                        setMenu(null);
                        setBase(branch);
                        setCommit(null);
                      }}
                    />
                  ))}
                </PickerList>
              )}
            </span>
          )}
          <span className="hs-flex-spacer" />
          <StripButton onClick={() => setAsked((n) => n + 1)}>
            <Icon name="refresh-line" size={13} />
          </StripButton>
        </div>
      )}
      {!root ? (
        <DiffNote
          text={
            repoError ??
            'No repository here yet. Grant a folder that is a git repository to read its branch as a pull request.'
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
      ) : refs && !base ? (
        <DiffNote text="This repository has one branch, so there is nothing to compare it with." />
      ) : log && 'error' in log ? (
        <DiffNote text={log.error} />
      ) : (
        <div className="pull-body">
          <div className="hs-scroll pull-commits">
            <div className="hs-settings-card">
              <ListPress
                label="All changes"
                tip={
                  commits &&
                  `${commits.commits.length}${commits.truncated ? '+' : ''} ${commits.commits.length === 1 ? 'commit' : 'commits'}`
                }
                current={commit === null}
                onClick={() => setCommit(null)}
              />
              {commits?.commits.map((each) => (
                <ListPress
                  key={each.sha}
                  label={each.subject}
                  tip={`${each.author}, ${dayOf(each.date)}`}
                  current={commit === each.sha}
                  onClick={() => setCommit(each.sha)}
                />
              ))}
            </div>
          </div>
          <div className="pull-change">
            {source === null || read === null ? null : 'error' in read ? (
              <DiffNote text={read.error} />
            ) : read.patch.trim() === '' ? (
              <DiffNote text={`${current} holds nothing that ${base} does not.`} />
            ) : (
              <DiffView
                patch={read.patch}
                loadFile={(path) => host.file(source, path)}
                split={look.split}
                wrap={look.wrap}
                onLook={setLook}
                onComment={(selection) =>
                  review.add(commentOn(source.root, scopeLabel(source), selection))
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
