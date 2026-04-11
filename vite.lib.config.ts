import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/index.ts', 'src/components', 'src/composables', 'src/types'],
      exclude: ['src/**/__tests__'],
      tsconfigPath: './tsconfig.app.json',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry:    fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name:     'ShiftWisher',
      fileName: 'shift-wisher',
      formats:  ['es', 'umd'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
    sourcemap: true,
    // Keep CSS injected — no separate .css file needed for a self-contained widget
    cssCodeSplit: false,
  },
})
