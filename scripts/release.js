#!/usr/bin/env node

/**
 * Chrome 扩展发布脚本
 *
 * 功能：
 * 1. 构建项目（调用 build.config.js）
 * 2. 创建发布用的 .zip 文件
 * 3. 只包含必要的生产文件
 * 4. 自动排除开发和构建文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  // 扩展名称（用于 zip 文件名）
  extensionName: 'DownloadTwitterPicture',

  // 版本（从 manifest.json 读取）
  version: null,

  // 发布包文件名
  get zipFileName() {
    return `${this.extensionName}-v${this.version}.zip`;
  },

  // 需要包含的文件和目录
  include: [
    'manifest.json',
    'content.js',
    'content.js.map',
    'background.js',
    'background.js.map',
    'popup.js',
    'popup.js.map',
    'inject.js',
    'popup.html',
    'rules.json',
    'images/',
    '_locales/'
  ],

  // 需要排除的文件和目录（glob 模式）
  exclude: [
    'src/**',
    'scripts/**',
    'node_modules/**',
    'tests/**',
    'docs/**',
    '*.md',
    'package*.json',
    'build.config.js',
    'vitest.config.js',
    '.git/**',
    '.github/**',
    '.gitignore',
    '.DS_Store',
    '**/.DS_Store',
    '*.zip'
  ]
};

/**
 * 读取 manifest.json 获取版本号
 */
function readVersion() {
  try {
    const manifestPath = path.join(process.cwd(), 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.version;
  } catch (error) {
    console.error('❌ 无法读取 manifest.json:', error.message);
    process.exit(1);
  }
}

/**
 * 检查文件是否存在
 */
function checkFilesExist() {
  console.log('🔍 检查必要文件...');

  const requiredFiles = [
    'manifest.json',
    'content.js',
    'background.js',
    'inject.js',
    'popup.html',
    'popup.js',
    'rules.json',
    'images/icon.png',
    '_locales/en/messages.json'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 缺少必要文件: ${file}`);
      process.exit(1);
    }
  }

  console.log('✅ 所有必要文件存在');
}

/**
 * 构建项目
 */
function buildProject() {
  console.log('🔨 开始构建项目...');

  try {
    // 调用 build.config.js
    const buildScript = path.join(process.cwd(), 'build.config.js');
    execSync(`node "${buildScript}"`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ 构建完成');
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
  }
}

/**
 * 创建发布包
 */
function createReleasePackage() {
  console.log('📦 创建发布包...');

  const version = readVersion();
  CONFIG.version = version;

  const zipFileName = CONFIG.zipFileName;
  const zipPath = path.join(process.cwd(), zipFileName);

  // 删除旧的 zip 文件
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
    console.log('🗑️  删除旧的发布包');
  }

  try {
    // 构建文件列表（包含文件，排除不需要的）
    const filesToInclude = CONFIG.include.filter(file => {
      const filePath = path.join(process.cwd(), file);
      return fs.existsSync(filePath);
    });

    // 构建 zip 命令
    // 使用系统的 zip 命令（macOS/Linux 自带）
    const excludeArgs = CONFIG.exclude.map(pattern => `-x "${pattern}"`).join(' ');
    const includeArgs = filesToInclude.join(' ');

    const command = `zip -r "${zipFileName}" ${includeArgs} ${excludeArgs}`;

    console.log(`执行: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // 检查 zip 文件是否创建成功
    if (!fs.existsSync(zipPath)) {
      throw new Error('zip 文件未生成');
    }

    // 显示 zip 文件信息
    const stats = fs.statSync(zipPath);
    console.log(`\n✅ 发布包创建成功!`);
    console.log(`📁 文件名: ${zipFileName}`);
    console.log(`📏 大小: ${(stats.size / 1024).toFixed(2)} KB`);

    // 列出 zip 内容（前 20 个文件）
    console.log('\n📋 发布包内容预览:');
    try {
      const output = execSync(`unzip -l "${zipFileName}"`, { encoding: 'utf8' });
      const lines = output.split('\n').slice(3, -2);
      lines.slice(0, 20).forEach(line => console.log('  ', line));
      if (lines.length > 20) {
        console.log(`  ... 还有 ${lines.length - 20} 个文件`);
      }
    } catch (error) {
      // unzip 命令可能不存在，忽略
    }

    console.log(`\n🚀 下一步: 上传 ${zipFileName} 到 Chrome Web Store`);
    console.log(`   https://chrome.google.com/webstore/devconsole`);

  } catch (error) {
    console.error('❌ 创建发布包失败:', error.message);
    process.exit(1);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('=================================================');
  console.log('  Chrome 扩展发布脚本');
  console.log('=================================================\n');

  // 检查必要文件
  checkFilesExist();

  // 构建项目
  buildProject();

  // 创建发布包
  createReleasePackage();

  console.log('\n✨ 发布流程完成!');
}

// 运行主函数
main();
