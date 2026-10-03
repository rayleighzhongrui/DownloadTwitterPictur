import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 测试 src/ 下的所有 .js，避开构建产物和 esbuild 入口
    include: ['tests/**/*.test.js'],
    environment: 'happy-dom',
    globals: false
  }
});
