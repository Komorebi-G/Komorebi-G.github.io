import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'node_modules/.bin/playwright-cli');
const session = 'personal-site-edge';
const endpoint = 'http://127.0.0.1:9333';
const site = 'http://localhost:4321/';
const output = join(root, 'output/playwright');
const args = process.argv.slice(2);

function run(command, argv) {
  const result = spawnSync(command, argv, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

async function probe(url, json = false) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return null;
    return json ? await response.json() : true;
  } catch { return null; }
}

async function waitFor(url, json = false) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = await probe(url, json);
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`无法连接 ${url}。检查 output/playwright 日志及 WSL 到 Windows 的 localhost 连通性；脚本不会修改防火墙。`);
}

try {
  mkdirSync(output, { recursive: true });
  if (args.length && args[0] !== 'start') {
    run(cli, [`-s=${session}`, ...args]);
  } else {
    if (process.platform !== 'linux' || !process.env.WSL_INTEROP) {
      throw new Error('请在启用 Windows 互操作的 WSL 终端运行。');
    }
    // Dedicated profile and port: never attach to the user's ordinary Edge profile.
    const powershell = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$profile = Join-Path $env:LOCALAPPDATA 'AgentBrowser\\personal-site-edge'
$existing = @(Get-CimInstance Win32_Process -Filter "name = 'msedge.exe'" | Where-Object { $_.CommandLine -match '--remote-debugging-port=9333(?:\\s|$)' })
if ($existing.Count -gt 0) {
  if (@($existing | Where-Object { $_.CommandLine -notlike ('*' + $profile + '*') }).Count -gt 0) {
    throw 'Port 9333 belongs to a different Edge profile.'
  }
} else {
  if (Get-NetTCPConnection -LocalPort 9333 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 9333 is already in use.' }
  $edge = Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'Microsoft\\Edge\\Application\\msedge.exe'
  if (!(Test-Path $edge)) { $edge = Join-Path $env:ProgramFiles 'Microsoft\\Edge\\Application\\msedge.exe' }
  Start-Process -FilePath $edge -ArgumentList @('--remote-debugging-port=9333', ('--user-data-dir="' + $profile + '"'), '--no-first-run', '--no-default-browser-check', 'about:blank')
}
Write-Output ('Edge profile: ' + $profile)
`;
    run('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', [
      '-NoProfile', '-NonInteractive', '-EncodedCommand',
      Buffer.from(powershell, 'utf16le').toString('base64'),
    ]);
    const browser = await waitFor(`${endpoint}/json/version`, true);
    if (!browser.Browser?.startsWith('Edg/')) throw new Error('调试端口不是 Microsoft Edge。');
    if (!await probe(site)) {
      const log = openSync(join(output, 'edge-site.log'), 'a');
      const child = spawn(join(root, 'node_modules/.bin/astro'), ['dev', '--host', '0.0.0.0', '--port', '4321'], {
        cwd: root, detached: true, stdio: ['ignore', log, log],
      });
      child.on('error', error => console.error(error.message));
      child.unref();
      closeSync(log);
      await waitFor(site);
      console.log(`网站服务 PID: ${child.pid}；日志: output/playwright/edge-site.log`);
    }
    run(cli, [`-s=${session}`, 'attach', '--cdp', endpoint]);
    run(cli, [`-s=${session}`, 'goto', site]);
    console.log('已连接 Windows Edge。后续操作：npm run edge -- snapshot / click <ref> / screenshot');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
