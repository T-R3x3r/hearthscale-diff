/**
 * The pull-request view, which fills its tab: the current branch of a
 * repository the person gave the app, as a pull request into a base
 * branch reads it, and the review of it.
 */
import { createRoot } from 'react-dom/client';
import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { Host } from './host.ts';
import { Pull } from './PullRequest.tsx';
import sheet from './ui.css?inline';

const style = document.createElement('style');
style.textContent = sheet;
document.head.append(style);

const app = new App({ name: 'Diff', version: '1.2.0' }, {}, { autoResize: false });
const host = new Host(app);
await app.connect(new PostMessageTransport(window.parent, window.parent));

const root = document.createElement('div');
root.className = 'diff-root';
document.body.append(root);
createRoot(root).render(<Pull host={host} />);
