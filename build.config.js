// esbuild 配置文件
// 使用方法：node build.config.js [--watch]

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const watch = process.argv.includes('--watch');

const contentConfig = {
  entryPoints: ['src/content.js'],
  bundle: true,
  outfile: 'content.js',
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  minify: false,
};

// Service Worker 在 MV3 中不能使用 ES module 静态导入 src/*，
// 因为发布脚本会把 src/ 排除掉。需要打成单文件 IIFE 并以 <script> 形式注入。
const backgroundConfig = {
  entryPoints: ['src/background.js'],
  bundle: true,
  outfile: 'background.js',
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  minify: false,
};

// Popup 脚本同样打包为单文件 IIFE，避免发布包排除 src/ 后模块找不到
const popupConfig = {
  entryPoints: ['src/popup.js'],
  bundle: true,
  outfile: 'popup.js',
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  minify: false,
};

async function reportOutput(file) {
  const stats = fs.statSync(file);
  console.log(`📦 ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
}

(async () => {
  try {
    console.log('🔨 开始构建...');

    if (watch) {
      const ctxs = await Promise.all([
        esbuild.context(contentConfig),
        esbuild.context(backgroundConfig),
        esbuild.context(popupConfig),
      ]);
      await Promise.all(ctxs.map(ctx => ctx.watch()));
      console.log('👀 监听文件变化 (content.js, background.js, popup.js)');
    } else {
      await esbuild.build(contentConfig);
      console.log('✅ content.js 打包成功');
      await esbuild.build(backgroundConfig);
      console.log('✅ background.js 打包成功');
      await esbuild.build(popupConfig);
      console.log('✅ popup.js 打包成功');
      await reportOutput('content.js');
      await reportOutput('background.js');
      await reportOutput('popup.js');
      console.log('✨ 构建完成！');
    }
  } catch (error) {
    console.error('❌ 打包失败:', error);
    process.exit(1);
  }
})();
