import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/* global console, process */

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const placeholder = /^(?:your[_-]|<|\$\{|\[|replace|change[-_ ]?me|example|placeholder|test[-_]|re_test|app[-_ ]?(?:password|pw)|secret[-_ ]?here|token[-_ ]?here|key[-_ ]?here|xxxxx)/i
const assignment = /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY))\s*[:=]\s*["'`]?([^\s"'`#]+)*/
const findings = []

for (const file of tracked) {
  let text
  try { text = readFileSync(file, 'utf8') } catch { continue }
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    const match = line.match(assignment)
    if (match) {
      const key = match[1].toUpperCase()
      const value = match[2] ?? ''
      const publicOrSafe = key.startsWith('VITE_') || key === 'SUPABASE_ANON_KEY' || key === 'GEMINI_MODEL'
      if (!publicOrSafe && value && !placeholder.test(value) && !file.endsWith('_test.ts')) findings.push(`${file}:${index + 1}: assignment:${key}`)
    }
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line)) findings.push(`${file}:${index + 1}: private-key`)
    if (/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/.test(line)) findings.push(`${file}:${index + 1}: telegram-token`)
    if (/\bre_[A-Za-z0-9]{20,}\b/.test(line) && !/re_test/i.test(line)) findings.push(`${file}:${index + 1}: resend-key`)
    if (/\bGOCSPX-[A-Za-z0-9_-]{20,}\b/.test(line)) findings.push(`${file}:${index + 1}: google-secret`)
  })
}

if (findings.length) {
  console.error('Secret scan failed. Categories and locations only:')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exitCode = 1
} else {
  console.log(`Secret scan passed for ${tracked.length} tracked files.`)
}
