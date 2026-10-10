/**
 * What the view asks of Hearthscale, typed: the folders the person gave
 * the app (`roots`), and what `git` says about the repositories in them,
 * each read confined by the platform to those folders and refused in
 * words; and the review comments the view adds to the context of the
 * chats on screen, which show as removable chips.
 */
import { App, McpUiMessageResultSchema } from '@modelcontextprotocol/ext-apps';

/** A folder the person gave the app, by its handle. */
export interface Mount {
  handle: string;
  path: string;
  mode: 'read' | 'read-write';
}

/** One repository: its top folder and the branch checked out, empty where
 *  HEAD is detached. */
export interface Repo {
  root: string;
  branch: string;
}

export interface Refs {
  current: string;
  branches: string[];
}

/** What a diff reads: a repository, one of the three scopes `git`
 *  answers, and the base a `branch` scope compares against. */
export interface DiffSource {
  root: string;
  scope: 'working' | 'staged' | 'branch';
  base?: string;
}

export interface Patch {
  patch: string;
  /** The cap cut the patch; what came back is whole files up to the cut. */
  truncated: boolean;
  /** How many changed files the patch leaves out because they lie in
   *  folders that hold credentials or another program's secrets. */
  hidden: number;
}

/** One MCP content block of the view's context. */
export type ContextBlock = Record<string, unknown> & { type: string };

/** The file an address names, `/?path=<absolute path>`; null for an
 *  address without one. */
function pathOf(link: unknown): string | null {
  const url = (link as { url?: unknown } | undefined)?.url;
  if (typeof url !== 'string') return null;
  return new URL(url, 'https://diff.invalid').searchParams.get('path');
}

export class Host {
  /** What hears each change of the host context. */
  private readonly listeners: ((changed: Record<string, unknown>) => void)[] = [];

  constructor(private readonly app: App) {
    app.onhostcontextchanged = (changed) => {
      for (const listener of this.listeners) listener(changed);
    };
  }

  /** One request of the host, its result whole; a refusal rejects with
   *  the SDK's error, whose words `wordsOf` reads. */
  private call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const request = this.app.request.bind(this.app) as (
      message: { method: string; params: Record<string, unknown> },
      schema: typeof McpUiMessageResultSchema,
    ) => Promise<unknown>;
    return request({ method, params }, McpUiMessageResultSchema) as Promise<T>;
  }

  /** The repositories the folders the person gave the app hold, each once. */
  async repos(): Promise<Repo[]> {
    const { mounts } = await this.call<{ mounts: Mount[] }>('hearthscale/roots/list');
    const found = new Map<string, Repo>();
    for (const mount of mounts) {
      if (mount.handle === 'data') continue;
      const { repo } = await this.call<{ repo: Repo | null }>('hearthscale/vcs/repo', {
        path: mount.path,
      }).catch(() => ({ repo: null }));
      if (repo) found.set(repo.root, repo);
    }
    return [...found.values()];
  }

  /** The system's picker, on the person's click; true when the person
   *  picked a folder. */
  async pick(): Promise<boolean> {
    const { mount } = await this.call<{ mount: Mount | null }>('hearthscale/roots/request', {
      purpose: 'Choose a repository to read its changes',
      shape: 'folder',
      mode: 'read',
    });
    return mount !== null;
  }

  refs(root: string): Promise<Refs> {
    return this.call('hearthscale/vcs/refs', { root });
  }

  diff(source: DiffSource): Promise<Patch> {
    return this.call('hearthscale/vcs/diff', { ...source });
  }

  /** One file whole, as a scope's new side holds it. */
  async file(source: DiffSource, path: string): Promise<string> {
    return (
      await this.call<{ text: string }>('hearthscale/vcs/file', {
        root: source.root,
        scope: source.scope,
        path,
      })
    ).text;
  }

  /** Replaces the blocks the view adds to the context of the chats on
   *  screen, on the person's click. */
  async context(blocks: ContextBlock[]): Promise<void> {
    await this.app.updateModelContext({ content: blocks as never });
  }

  /** The view's blocks the chats still hold: none once the person removed
   *  them or a message took them. */
  held(): ContextBlock[] {
    const state = this.app.getHostContext()?.['openai/modelContext'] as
      { content?: ContextBlock[] } | null | undefined;
    return state?.content ?? [];
  }

  /** Calls `fn` each time the host says what the chats still hold. */
  onHeld(fn: () => void): void {
    this.listeners.push((changed) => {
      if ('openai/modelContext' in changed) fn();
    });
  }

  /** The repository a folder lies in; null outside one. */
  async repo(path: string): Promise<Repo | null> {
    return (await this.call<{ repo: Repo | null }>('hearthscale/vcs/repo', { path })).repo;
  }

  /** The file whose change the window opened the view at, such as a file
   *  a turn changed; null when it opened on none. */
  revealed(): string | null {
    return pathOf(this.app.getHostContext()?.['openai/deepLink']);
  }

  /** Calls `fn` with each file the window opens the view at while it
   *  shows. */
  onRevealed(fn: (path: string) => void): void {
    this.listeners.push((changed) => {
      const path = pathOf(changed['openai/deepLink']);
      if (path !== null) fn(path);
    });
  }
}

/** A refusal's words, as the view shows them: the host's words, without
 *  the "MCP error <code>: " that the MCP SDK puts before the message of a
 *  refused request. */
export const wordsOf = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).replace(/^MCP error -?\d+: /, '');
