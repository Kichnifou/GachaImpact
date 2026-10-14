import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const baseline = '88542e0287668d2c072f67be2afa875b4113c050'
const file = 'docs/master/PROJECT_MASTER_PLAN.md'
const normalize = text => text.replace(/\r\n/g, '\n')
const before = normalize(execFileSync('git', ['show', `${baseline}:${file}`], { maxBuffer: 10 * 1024 * 1024 }).toString('utf8'))
const after = normalize(readFileSync(file, 'utf8'))
const marker = '## R1092 — trois micro-finitions desktop en continuité R1091 (14/10/2026)'
assert.equal(before.split(marker).length, 2, 'Baseline history anchor must be unique')
assert.equal(after.split(marker).length, 2, 'Current history anchor must be unique')
const history = before.slice(before.indexOf(marker))
assert.equal(after.slice(after.indexOf(marker)), history, 'Untouched Master history must remain identical')
assert.equal(after.slice(-2000), before.slice(-2000), 'Final Master sections must be preserved')
assert(after.length >= before.length, 'Master must not be truncated')
console.log(JSON.stringify({ baseline, beforeBytes: Buffer.byteLength(before), afterBytes: Buffer.byteLength(after), beforeLines: before.split('\n').length, afterLines: after.split('\n').length, historyBytes: Buffer.byteLength(history), historySha256: createHash('sha256').update(history).digest('hex'), finalSectionsIdentical: true, pass: true }))
