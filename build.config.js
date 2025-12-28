// esbuild 配置文件
// 使用方法：node build.config.js

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    console.log('🔨 开始构建...');

    // 打包 content script（直接输出到根目录）
    await esbuild.build({
      entryPoints: ['src/content.js'],
      bundle: true,
      outfile: 'content.js',
      format: 'iife', // 立即执行函数表达式，适合 content scripts
      target: 'es2020',
      sourcemap: true,
      minify: false, // 保持可读性
    });

    console.log('✅ 打包成功: content.js');

    // 统计代码量
    const stats = fs.statSync('content.js');
    console.log(`📦 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`📝 代码行数: ${require('fs').readFileSync('content.js', 'utf8').split('\n').length} 行`);
    console.log('✨ 构建完成！');

  } catch (error) {
    console.error('❌ 打包失败:', error);
    process.exit(1);
  }
})();
