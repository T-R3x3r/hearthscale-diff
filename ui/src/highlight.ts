/**
 * Syntax colour for the rows of a patch, from Shiki with the two GitHub
 * themes, as Hearthscale colours its own code: every token carries both
 * colours as `--shiki-light` and `--shiki-dark`, and the kit's
 * `hs-diff-tok` takes the one of the scheme on the page. The highlighter
 * loads once, on the first file that needs it, with each grammar on the
 * first file of its language; a file of a language it does not know
 * stays plain.
 */
import type { CSSProperties } from 'react';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

/** One coloured piece of a line. */
export interface Token {
  text: string;
  style: CSSProperties;
}

type Grammar = () => Promise<{ default: unknown }>;

const TYPESCRIPT: Grammar = () => import('shiki/dist/langs/typescript.mjs');
const JAVASCRIPT: Grammar = () => import('shiki/dist/langs/javascript.mjs');
const C: Grammar = () => import('shiki/dist/langs/c.mjs');
const CPP: Grammar = () => import('shiki/dist/langs/cpp.mjs');
const MARKDOWN: Grammar = () => import('shiki/dist/langs/markdown.mjs');
const YAML: Grammar = () => import('shiki/dist/langs/yaml.mjs');
const SHELL: Grammar = () => import('shiki/dist/langs/shellscript.mjs');
const HTML: Grammar = () => import('shiki/dist/langs/html.mjs');

/** The grammar of each file name ending, and the language it names. */
const LANGUAGES: Record<string, [string, Grammar]> = {
  ts: ['typescript', TYPESCRIPT],
  mts: ['typescript', TYPESCRIPT],
  cts: ['typescript', TYPESCRIPT],
  tsx: ['tsx', () => import('shiki/dist/langs/tsx.mjs')],
  js: ['javascript', JAVASCRIPT],
  mjs: ['javascript', JAVASCRIPT],
  cjs: ['javascript', JAVASCRIPT],
  jsx: ['jsx', () => import('shiki/dist/langs/jsx.mjs')],
  json: ['json', () => import('shiki/dist/langs/json.mjs')],
  css: ['css', () => import('shiki/dist/langs/css.mjs')],
  scss: ['scss', () => import('shiki/dist/langs/scss.mjs')],
  html: ['html', HTML],
  htm: ['html', HTML],
  vue: ['vue', () => import('shiki/dist/langs/vue.mjs')],
  svelte: ['svelte', () => import('shiki/dist/langs/svelte.mjs')],
  md: ['markdown', MARKDOWN],
  markdown: ['markdown', MARKDOWN],
  py: ['python', () => import('shiki/dist/langs/python.mjs')],
  rs: ['rust', () => import('shiki/dist/langs/rust.mjs')],
  go: ['go', () => import('shiki/dist/langs/go.mjs')],
  java: ['java', () => import('shiki/dist/langs/java.mjs')],
  kt: ['kotlin', () => import('shiki/dist/langs/kotlin.mjs')],
  swift: ['swift', () => import('shiki/dist/langs/swift.mjs')],
  c: ['c', C],
  h: ['c', C],
  cc: ['cpp', CPP],
  cpp: ['cpp', CPP],
  hpp: ['cpp', CPP],
  cs: ['csharp', () => import('shiki/dist/langs/csharp.mjs')],
  rb: ['ruby', () => import('shiki/dist/langs/ruby.mjs')],
  php: ['php', () => import('shiki/dist/langs/php.mjs')],
  sh: ['shellscript', SHELL],
  bash: ['shellscript', SHELL],
  ps1: ['powershell', () => import('shiki/dist/langs/powershell.mjs')],
  yaml: ['yaml', YAML],
  yml: ['yaml', YAML],
  toml: ['toml', () => import('shiki/dist/langs/toml.mjs')],
  sql: ['sql', () => import('shiki/dist/langs/sql.mjs')],
  xml: ['xml', () => import('shiki/dist/langs/xml.mjs')],
};

let core: Promise<HighlighterCore> | null = null;
const loaded = new Map<string, Promise<void>>();

/** The language of a file by its name; null for one the highlighter does
 *  not know. */
export function languageOf(path: string): string | null {
  const ending = /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase();
  return (ending && LANGUAGES[ending]?.[0]) ?? null;
}

/** The tokens of each line of `lines`, read as one text in the language
 *  of `path`, so a line inside a comment or a string that began above it
 *  is coloured as one; null for a file of a language with no grammar. */
export async function highlightLines(path: string, lines: string[]): Promise<Token[][] | null> {
  const ending = /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase();
  const known = ending ? LANGUAGES[ending] : undefined;
  if (!known) return null;
  const [language, grammar] = known;
  core ??= createHighlighterCore({
    themes: [
      import('shiki/dist/themes/github-light.mjs'),
      import('shiki/dist/themes/github-dark.mjs'),
    ],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  const highlighter = await core;
  if (!loaded.has(language)) {
    loaded.set(
      language,
      grammar().then((g) => highlighter.loadLanguage(g.default as never)),
    );
  }
  await loaded.get(language);
  const tokens = highlighter.codeToTokensWithThemes(lines.join('\n'), {
    lang: language,
    themes: { light: 'github-light', dark: 'github-dark' },
  });
  return tokens.map((line) =>
    line.map((token) => ({
      text: token.content,
      style: {
        '--shiki-light': token.variants.light?.color,
        '--shiki-dark': token.variants.dark?.color,
      } as CSSProperties,
    })),
  );
}
