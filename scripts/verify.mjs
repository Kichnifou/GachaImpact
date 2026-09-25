import { closeSync, mkdtempSync, openSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
if (mode !== 'quick' && mode !== 'full') {
  console.error('Usage: node scripts/verify.mjs quick|full')
  process.exit(2)
}

const npmCli = process.env.npm_execpath
const npmCommand = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npmArgs = (args) => npmCli ? [npmCli, ...args] : args
const steps = mode === 'quick'
  ? [
      ['frontend typecheck', root, 'typecheck'],
      ['backend typecheck', join(root, 'server'), 'typecheck'],
      ['frontend lint', root, 'lint'],
    ]
  : [
      ['frontend tests', root, 'test'],
      ['backend non-DB tests', join(root, 'server'), 'test'],
      ['frontend build + typecheck', root, 'build'],
      ['backend typecheck', join(root, 'server'), 'typecheck'],
      ['backend build', join(root, 'server'), 'build'],
      ['frontend lint', root, 'lint'],
    ]

const logDirectory = mkdtempSync(join(tmpdir(), `gachaimpact-verify-${mode}-`))
const results = []
console.log(`verify:${mode} — logs complets : ${logDirectory}`)
for (const [label, cwd, script] of steps) {
  const log = join(logDirectory, `${String(results.length + 1).padStart(2, '0')}-${script}.log`)
  const fd = openSync(log, 'w')
  const started = Date.now()
  const result = spawnSync(npmCommand, npmArgs(['run', script]), {
    cwd,
    env: process.env,
    shell: !npmCli && process.platform === 'win32',
    stdio: ['ignore', fd, fd],
  })
  closeSync(fd)
  const passed = result.status === 0
  results.push({ label, passed, log, status: result.status, error: result.error })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label} (${((Date.now() - started) / 1000).toFixed(1)} s)`)
  if (!passed) {
    const lines = readFileSync(log, 'utf8').split(/\r?\n/)
    console.error(`  Code de retour : ${result.status ?? result.signal ?? result.error?.message ?? 'inconnu'} ; log : ${log}`)
    console.error(lines.slice(-80).join('\n'))
  }
}

for (const [label, args] of [['worktree diff-check', ['diff', '--check']], ['index diff-check', ['diff', '--cached', '--check']]]) {
  const log = join(logDirectory, `${String(results.length + 1).padStart(2, '0')}-git.log`)
  const fd = openSync(log, 'w')
  const result = spawnSync('git', args, { cwd: root, stdio: ['ignore', fd, fd] })
  closeSync(fd)
  const passed = result.status === 0
  results.push({ label, passed, log, status: result.status, error: result.error })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
  if (!passed) console.error(`  Code de retour : ${result.status ?? result.signal ?? result.error?.message ?? 'inconnu'} ; log : ${log}\n${readFileSync(log, 'utf8')}`)
}

const failures = results.filter((result) => !result.passed)
console.log(`${failures.length ? 'FAIL' : 'PASS'} verify:${mode} — ${results.length - failures.length}/${results.length} étapes réussies`)
if (failures.length) process.exitCode = 1
