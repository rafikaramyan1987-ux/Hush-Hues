/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';

/**
 * Two build targets:
 *  - default ("production"): GitHub Pages build, no external scripts at all.
 *  - "crazygames": same game + the official CrazyGames SDK v3 script tag in <head>
 *    (the SDK must be loaded from CrazyGames' own URL, as their docs require).
 */
function crazyGamesSdk(enabled: boolean): Plugin {
  return {
    name: 'crazygames-sdk',
    transformIndexHtml(html) {
      if (!enabled) return html;
      return html.replace(
        '<!--CRAZYGAMES_SDK-->',
        '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const cg = mode === 'crazygames';
  return {
    base: './',
    define: {
      __TARGET__: JSON.stringify(cg ? 'crazygames' : 'web'),
    },
    plugins: [crazyGamesSdk(cg)],
    build: {
      outDir: cg ? 'dist-crazygames' : 'dist',
      target: 'es2020',
      assetsInlineLimit: 0,
      reportCompressedSize: false,
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
