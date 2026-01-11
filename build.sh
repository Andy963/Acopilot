#!/bin/bash
set -e

echo "🧹 清理旧的 vsix 文件..."
rm -f *.vsix

echo "📦 安装后端依赖（npm，用于 vsce 依赖检测）..."
rm -rf node_modules
npm install --no-package-lock

echo "📦 安装前端依赖..."
(cd frontend && pnpm install --frozen-lockfile=false)

echo "🔨 编译项目..."
pnpm run build

echo "📦 打包插件..."
npx @vscode/vsce package --dependencies

echo "✅ 完成!"
ls -la *.vsix
