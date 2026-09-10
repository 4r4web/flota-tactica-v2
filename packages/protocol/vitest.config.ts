import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@flota/domain': fileURLToPath(new URL('../domain/src/index.ts', import.meta.url)),
    },
  },
});
