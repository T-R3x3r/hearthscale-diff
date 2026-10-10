/**
 * The Diff view, which fills the app's tab: the changes of a repository
 * the person gave the app, and the review of them.
 */
import { createRoot } from 'react-dom/client';
import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { Diff } from './Diff.tsx';
import { Host } from './host.ts';
import sheet from './ui.css?inline';

const style = document.createElement('style');
style.textContent = sheet;
document.head.append(style);

const app = new App({ name: 'Diff', version: '1.1.1' }, {}, { autoResize: false });
const host = new Host(app);
await app.connect(new PostMessageTransport(window.parent, window.parent));

const root = document.createElement('div');
root.className = 'diff-root';
document.body.append(root);
createRoot(root).render(<Diff host={host} />);
