#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_SMOKE_TIMEOUT_MS = 60000;
const DEFAULT_SMOKE_SOURCE = 'development';
const repoRoot = path.resolve(__dirname, '..');
const smokeTimeoutMs = Number.parseInt(process.env.ACOPILOT_SMOKE_TIMEOUT_MS ?? '', 10) || DEFAULT_SMOKE_TIMEOUT_MS;
const isWsl = Boolean(process.env.WSL_DISTRO_NAME);

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCodeBinary() {
  if (isWsl) {
    const shellPath = await resolveCodeShellPath();
    const codeCmdPath = path.join(path.dirname(shellPath), 'code.cmd');
    return {
      command: 'cmd.exe',
      prefixArgs: ['/d', '/c', await toWindowsPath(codeCmdPath)],
      windowsPaths: true
    };
  }

  const candidates = [
    process.env.VSCODE_BIN,
    'code',
    'code-insiders',
    'codium'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const child = spawn(candidate, ['--version'], {
        stdio: 'ignore'
      });

      const exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', resolve);
      });

      if (exitCode === 0) {
        return {
          command: candidate,
          prefixArgs: [],
          windowsPaths: false
        };
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('Unable to locate a VS Code CLI binary. Set VSCODE_BIN to override.');
}

async function resolveCodeShellPath() {
  const candidates = ['code', 'code-insiders', 'codium'];

  for (const candidate of candidates) {
    try {
      const child = spawn('which', [candidate], {
        stdio: ['ignore', 'pipe', 'ignore']
      });

      let stdout = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      const exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', resolve);
      });

      if (exitCode === 0 && stdout.trim()) {
        return stdout.trim();
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('Unable to resolve the VS Code shell path from WSL.');
}

async function toWindowsPath(targetPath) {
  if (!isWsl) {
    return targetPath;
  }

  const child = spawn('wslpath', ['-w', targetPath], {
    stdio: ['ignore', 'pipe', 'ignore']
  });

  let stdout = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`Unable to convert path to Windows format: ${targetPath}`);
  }

  return stdout.trim();
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pathExists(filePath)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for smoke output file: ${filePath}`);
}

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SMOKE_SOURCE,
    vsixPath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--source') {
      options.source = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--source=')) {
      options.source = arg.slice('--source='.length);
      continue;
    }

    if (arg === '--vsix') {
      options.vsixPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--vsix=')) {
      options.vsixPath = arg.slice('--vsix='.length);
      continue;
    }

    throw new Error(`Unsupported smoke argument: ${arg}`);
  }

  if (options.source !== 'development' && options.source !== 'vsix') {
    throw new Error(`Unsupported smoke source: ${options.source}`);
  }

  return options;
}

async function resolveVsixPath(explicitVsixPath) {
  if (explicitVsixPath) {
    const resolved = path.isAbsolute(explicitVsixPath)
      ? explicitVsixPath
      : path.resolve(repoRoot, explicitVsixPath);
    if (!(await pathExists(resolved))) {
      throw new Error(`Packaged VSIX not found: ${resolved}`);
    }
    return resolved;
  }

  const packageJson = await readJson(path.join(repoRoot, 'package.json'));
  const expectedVsixPath = path.join(repoRoot, `${packageJson.name}-${packageJson.version}.vsix`);
  if (await pathExists(expectedVsixPath)) {
    return expectedVsixPath;
  }

  const vsixEntries = (await fs.readdir(repoRoot))
    .filter((entry) => entry.endsWith('.vsix'))
    .sort();

  if (vsixEntries.length === 1) {
    return path.join(repoRoot, vsixEntries[0]);
  }

  throw new Error(
    `Unable to resolve a packaged VSIX artifact in ${repoRoot}. ` +
    'Run `npm run package` first or pass `--vsix=/absolute/path/to/file.vsix`.'
  );
}

async function runProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitInfo = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  return {
    command: [command, ...args].join(' '),
    exitCode: exitInfo.code,
    signal: exitInfo.signal,
    stdout,
    stderr
  };
}

async function installVsix(codeBinary, vsixPath, userDataArg, extensionsArg) {
  const vsixArg = codeBinary.windowsPaths ? await toWindowsPath(vsixPath) : vsixPath;
  const args = [
    ...codeBinary.prefixArgs,
    '--install-extension',
    vsixArg,
    '--force',
    '--user-data-dir',
    userDataArg,
    '--extensions-dir',
    extensionsArg
  ];

  const result = await runProcess(codeBinary.command, args);
  if (result.exitCode !== 0) {
    const error = new Error(`VSIX installation failed with exit code ${result.exitCode}.`);
    error.installResult = result;
    throw error;
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const tempParent = path.join(repoRoot, '.tmp');
  await fs.mkdir(tempParent, { recursive: true });
  const tempRoot = await fs.mkdtemp(path.join(tempParent, 'acopilot-vscode-smoke-'));
  const workspaceDir = repoRoot;
  const markerPath = path.join(repoRoot, '.acopilot-smoke.json');
  const outputPath = path.join(tempRoot, 'smoke-result.json');
  const userDataDir = path.join(tempRoot, 'user-data');
  const extensionsDir = path.join(tempRoot, 'extensions');
  const codeBinary = await resolveCodeBinary();
  const vsixPath = options.source === 'vsix' ? await resolveVsixPath(options.vsixPath) : null;

  await fs.mkdir(userDataDir, { recursive: true });
  await fs.mkdir(extensionsDir, { recursive: true });
  const outputPathValue = codeBinary.windowsPaths ? await toWindowsPath(outputPath) : outputPath;
  const workspaceArg = codeBinary.windowsPaths ? await toWindowsPath(workspaceDir) : workspaceDir;
  const userDataArg = codeBinary.windowsPaths ? await toWindowsPath(userDataDir) : userDataDir;
  const extensionsArg = codeBinary.windowsPaths ? await toWindowsPath(extensionsDir) : extensionsDir;
  const extensionDevelopmentArg = codeBinary.windowsPaths ? await toWindowsPath(repoRoot) : repoRoot;
  const expectedExtensionPathPrefix = options.source === 'vsix' ? extensionsArg : extensionDevelopmentArg;

  let install = null;
  if (vsixPath) {
    install = await installVsix(codeBinary, vsixPath, userDataArg, extensionsArg);
  }

  await fs.writeFile(
    markerPath,
    JSON.stringify(
      {
        outputPath: outputPathValue,
        timeoutMs: smokeTimeoutMs,
        expectedSource: options.source,
        expectedExtensionPathPrefix
      },
      null,
      2
    ),
    'utf8'
  );

  const args = [
    '--new-window',
    '--wait',
    '--disable-gpu',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--user-data-dir',
    userDataArg,
    '--extensions-dir',
    extensionsArg,
    workspaceArg
  ];

  if (options.source === 'development') {
    args.splice(3, 0, '--disable-extensions');
    args.splice(args.length - 1, 0, '--extensionDevelopmentPath', extensionDevelopmentArg);
  }

  const startedAt = Date.now();
  const child = spawn(codeBinary.command, [...codeBinary.prefixArgs, ...args], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${smokeTimeoutMs}ms waiting for VS Code smoke run to finish.`));
    }, smokeTimeoutMs + 5000);

    child.once('exit', () => clearTimeout(timer));
  });

  const exitPromise = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  let exitInfo;
  try {
    exitInfo = await Promise.race([exitPromise, timeoutPromise]);
    await waitForFile(outputPath, 5000);
  } catch (error) {
    child.kill('SIGTERM');
    const partialSmoke = await pathExists(outputPath).then((exists) => (exists ? readJson(outputPath) : null));
    await fs.rm(markerPath, { force: true });
    const failure = {
      ok: false,
      status: 'error',
      source: options.source,
      vsixPath,
      durationMs: Date.now() - startedAt,
      repoRoot,
      outputPath,
      command: [codeBinary.command, ...codeBinary.prefixArgs, ...args].join(' '),
      install,
      exitCode: exitInfo?.code ?? null,
      signal: exitInfo?.signal ?? null,
      smoke: partialSmoke,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
      stdout,
      stderr
    };
    process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exit(1);
  }

  const smoke = await readJson(outputPath);
  await fs.rm(markerPath, { force: true });
  const success = exitInfo.code === 0 && smoke.ok === true;
  const result = {
    ok: success,
    status: success ? 'ok' : 'error',
    source: options.source,
    vsixPath,
    durationMs: Date.now() - startedAt,
    repoRoot,
    outputPath,
    command: [codeBinary.command, ...codeBinary.prefixArgs, ...args].join(' '),
    install,
    exitCode: exitInfo.code,
    signal: exitInfo.signal,
    smoke,
    stdout,
    stderr
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  const failure = {
    ok: false,
    status: 'error',
    source: (() => {
      try {
        return parseArgs(process.argv.slice(2)).source;
      } catch {
        return DEFAULT_SMOKE_SOURCE;
      }
    })(),
    install: error && typeof error === 'object' && 'installResult' in error ? error.installResult : null,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) }
  };
  process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exit(1);
});
