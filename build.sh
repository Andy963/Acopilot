#!/bin/bash
set -e

echo "🧹 清理旧的 vsix 文件..."
rm -f *.vsix

echo "📦 安装前端依赖..."
(cd frontend && pnpm install --frozen-lockfile=false)

echo "🔨 编译项目..."
pnpm run build

echo "📦 打包插件..."
npx @vscode/vsce package --no-dependencies

echo "✅ 完成!"
ls -la *.vsix
