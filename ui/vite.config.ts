import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Each view is one module, `views/diff.js` and, built in the `pull` mode,
// `views/pull.js`, which the platform inlines into the document it frames
// the view in. That document maps the MCP Apps SDK to the platform's own
// copy and loads the kit's style sheet and icon font, so the build leaves
// the SDK as an import and bundles the rest, its own styles and the
// grammars of the highlighter included.
export default defineConfig(({ mode }) => {
  const view = mode === 'pull' ? 'pull' : 'diff';
  return {
    plugins: [react()],
    build: {
      outDir: '../views',
      emptyOutDir: false,
      target: 'es2022',
      modulePreload: false,
      chunkSizeWarningLimit: 16384,
      rollupOptions: {
        input: view === 'pull' ? 'src/pull.tsx' : 'src/index.tsx',
        external: ['@modelcontextprotocol/ext-apps'],
        output: {
          format: 'es',
          inlineDynamicImports: true,
          entryFileNames: `${view}.js`,
        },
      },
    },
  };
});
