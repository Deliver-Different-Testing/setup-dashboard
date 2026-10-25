#!/usr/bin/env node
// Builds manifest.json from the front matter of every article in this folder, and checks faqs.json
// points only at articles that exist. No dependencies. Run: node docs/help/build-manifest.mjs
//
// A CSP publisher (see README.md, "Publishing into CSP") reads manifest.json + faqs.json + the article
// bodies and upserts CrmKbCategories / CrmKbArticles / CrmKbFaqs by sourceId in each tenant database.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const skip = new Set(['README.md'])

function frontMatter(text, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)
  if (!m) throw new Error(`${file}: no front matter`)
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    let value = line.slice(i + 1).trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    }
    meta[key] = value
  }
  for (const k of ['sourceId', 'title', 'category', 'audience', 'tags']) {
    if (!meta[k] || meta[k].length === 0) throw new Error(`${file}: front matter is missing ${k}`)
  }
  if (!meta.sourceId.startsWith('setup-dashboard/')) throw new Error(`${file}: sourceId must start with setup-dashboard/`)
  if (meta.title.length > 200) throw new Error(`${file}: title over 200 characters`)
  if (meta.tags.join(',').length > 500) throw new Error(`${file}: tags over 500 characters`)
  return { meta, body: m[2].trim() }
}

const articles = []
const ids = new Set()
for (const file of readdirSync(here).filter(f => f.endsWith('.md') && !skip.has(f)).sort()) {
  const { meta, body } = frontMatter(readFileSync(join(here, file), 'utf8'), file)
  if (ids.has(meta.sourceId)) throw new Error(`${file}: duplicate sourceId ${meta.sourceId}`)
  ids.add(meta.sourceId)
  const lead = body.split(/\r?\n\r?\n/)[0].replace(/\s+/g, ' ')
  articles.push({
    sourceId: meta.sourceId,
    file,
    title: meta.title,
    category: meta.category,
    audience: meta.audience,
    tags: meta.tags,
    layer: 'shipped',
    words: body.split(/\s+/).length,
    leadChars: lead.length,
    leadOver400: lead.length > 400,
  })
}

const faqs = JSON.parse(readFileSync(join(here, 'faqs.json'), 'utf8'))
const problems = []
for (const f of faqs) {
  if (!ids.has(f.sourceId)) problems.push(`faq "${f.question}" points at unknown article ${f.sourceId}`)
  if (f.answer.length > 400) problems.push(`faq "${f.question}" answer is ${f.answer.length} chars (Auto-Mate reads 400)`)
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const manifest = {
  generatedAt: new Date().toISOString(),
  source: 'Deliver-Different-Testing/setup-dashboard docs/help',
  layer: 'shipped',
  isManaged: true,
  articleCount: articles.length,
  faqCount: faqs.length,
  articles,
}
writeFileSync(join(here, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

const over = articles.filter(a => a.leadOver400)
console.log(`${articles.length} articles, ${faqs.length} FAQs -> manifest.json`)
if (over.length) console.log(`Lead paragraph over 400 chars (Auto-Mate truncates): ${over.map(a => a.file).join(', ')}`)
