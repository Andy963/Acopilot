import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  parseFrontendBuildAssets,
  resolveFrontendAssetFsPath,
} from '../webview/utils/webviewAssets';

describe('parseFrontendBuildAssets', () => {
  it('extracts the built script and stylesheet paths from vite index.html', () => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <link rel="stylesheet" crossorigin href="/index60.css">
  <link rel="icon" href="/favicon.ico">
</head>
<body>
  <div id="app"></div>
  <script type="module" crossorigin src="/index.js"></script>
</body>
</html>`;

    expect(parseFrontendBuildAssets(html)).toEqual({
      scriptPaths: ['index.js'],
      stylePaths: ['index60.css'],
    });
  });

  it('ignores external or unsafe asset paths', () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://example.com/remote.css">
  <link rel="stylesheet" href="/assets/main.css?hash=123">
</head>
<body>
  <script src="//cdn.example.com/remote.js"></script>
  <script src="../escape.js"></script>
  <script src="/assets/index.js"></script>
</body>
</html>`;

    expect(parseFrontendBuildAssets(html)).toEqual({
      scriptPaths: ['assets/index.js'],
      stylePaths: ['assets/main.css'],
    });
  });
});

describe('resolveFrontendAssetFsPath', () => {
  it('joins normalized asset paths under the dist directory', () => {
    expect(resolveFrontendAssetFsPath('/tmp/frontend/dist', 'assets/index.js')).toBe(
      path.join('/tmp/frontend/dist', 'assets/index.js'),
    );
  });
});
