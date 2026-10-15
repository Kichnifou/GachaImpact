import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const baseline = '1b26b0167d302c47f7352baba6a6d5a8e1a521d3'
const file = 'docs/master/PROJECT_MASTER_PLAN.md'
const normalize = value => value.replace(/\r\n/g, '\n')
const before = normalize(execFileSync('git', ['show', `${baseline}:${file}`], { maxBuffer: 4 * 1024 * 1024 }).toString('utf8'))
const after = normalize(readFileSync(file, 'utf8'))
const marker = '## R1095'
assert.equal(before.split(marker).length, 2)
assert.equal(after.split(marker).length, 2)
const history = before.slice(before.indexOf(marker))
assert.equal(after.slice(after.indexOf(marker)), history)
assert.equal(after.slice(-3000), before.slice(-3000))
assert(after.length > before.length)
console.log(JSON.stringify({ baseline, historyBytes: Buffer.byteLength(history), historySha256: createHash('sha256').update(history).digest('hex'), finalSectionsIdentical: true, pass: true }))
