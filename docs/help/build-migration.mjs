#!/usr/bin/env node
// Publishing option A (see README.md): render every article in this folder into one idempotent SQL
// migration for dbmigrationsv2 that upserts the CSP Knowledge Base "shipped" collection by SourceId
// in each tenant database. No dependencies.
//
//   node docs/help/build-migration.mjs <out.sql> [--version <label>] [--url-base <github blob url>]
//
// What it writes (per tenant DB, on the next dbmigrationsv2 deploy):
//   CrmKbCategories  one row per distinct `category` in the shipped layer (matched by Layer + Name)
//   CrmKbArticles    MERGE by SourceId: Layer 'shipped', IsManaged 1, Status 'published', title, HTML,
//                    flattened text, audience, tags, SourceVersion, SourceDocumentUrl, LastSyncedDateUtc.
//                    Insert sets PublishedDateUtc; update leaves IsHidden (a tenant's choice) alone.
//   CrmKbFaqs        replaced for these articles: delete the article's FAQs, insert from faqs.json.
//
// The MERGE matches the shape CSP writes itself (KnowledgeBaseService.CreateArticleAsync: ContentText =
// tags stripped + HTML-decoded + whitespace collapsed).

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const out = args.find(a => !a.startsWith('--'))
if (!out) { console.error('usage: build-migration.mjs <out.sql> [--version <label>] [--url-base <url>]'); process.exit(1) }
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt }

let gitSha = 'unknown'
try { gitSha = execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim() } catch { /* not a git checkout */ }
const version = opt('--version', `${new Date().toISOString().slice(0, 10)}-${gitSha}`)
const urlBase = opt('--url-base', 'https://github.com/Deliver-Different-Testing/setup-dashboard/blob/feat/settings-rewrite/docs/help')

// ── front matter + markdown → HTML ──────────────────────────────────────────

function frontMatter(text, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)
  if (!m) throw new Error(`${file}: no front matter`)
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    let value = line.slice(i + 1).trim()
    if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    meta[key] = value
  }
  return { meta, body: m[2].trim() }
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

/** Headings, paragraphs, bullet lists, pipe tables, bold, code. Enough for this folder; nothing clever. */
function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) { html.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); i++; continue }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`); i++ }
      html.push(`<ul>${items.join('')}</ul>`); continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`); i++ }
      html.push(`<ol>${items.join('')}</ol>`); continue
    }
    if (line.trim().startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++ }
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const [head, sep, ...body] = rows
      if (sep && /^\|?\s*:?-+/.test(sep)) {
        html.push('<table><thead><tr>' + cells(head).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
          + body.map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>')
      } else {
        for (const r of rows) html.push(`<p>${inline(r)}</p>`)
      }
      continue
    }
    // paragraph: consecutive non-blank lines; a line ending in two spaces or a lone short line keeps its break
    const para = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) { para.push(lines[i].trim()); i++ }
    html.push(`<p>${para.map(inline).join('<br>')}</p>`)
  }
  return html.join('\n')
}

/** Same as KnowledgeBaseService.Flatten: strip tags, decode entities, collapse whitespace. */
function flatten(html) {
  const text = html.replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  return text.replace(/\s+/g, ' ').trim()
}

const q = s => `N'${String(s).replace(/'/g, "''")}'`

// ── load ────────────────────────────────────────────────────────────────────

const files = readdirSync(here).filter(f => f.endsWith('.md') && f !== 'README.md').sort()
const articles = files.map(file => {
  const { meta, body } = frontMatter(readFileSync(join(here, file), 'utf8'), file)
  const html = markdownToHtml(body)
  return {
    file, sourceId: meta.sourceId, title: meta.title, category: meta.category,
    audience: meta.audience.join(','), tags: meta.tags.join(','),
    html, text: flatten(html), url: `${urlBase}/${file}`,
  }
})
const faqs = JSON.parse(readFileSync(join(here, 'faqs.json'), 'utf8'))
const ids = new Set(articles.map(a => a.sourceId))
for (const f of faqs) if (!ids.has(f.sourceId)) throw new Error(`faq points at unknown article ${f.sourceId}`)
const categories = [...new Set(articles.map(a => a.category))]

// ── emit ────────────────────────────────────────────────────────────────────

const sql = []
sql.push(`-- Migration: ${basename(out, '.sql').replace(/^\d+_/, '')}
-- Created: ${new Date().toISOString().slice(0, 10)}
--
-- Publishes the Setup Dashboard help centre into the CSP Knowledge Base "shipped" collection
-- ("Deliver Different guides") of every tenant: ${articles.length} articles + ${faqs.length} FAQs.
-- Source: ${urlBase} (version ${version}). Generated by docs/help/build-migration.mjs - do not hand-edit;
-- change the markdown and regenerate as a NEW migration file.
--
-- Shipped content is DF-managed: CSP's own API refuses to create or edit it (RequireAuthorableLayer), so a
-- migration is the only write path today. Upsert key = CrmKbArticles.SourceId (unique filtered index).
-- A tenant's IsHidden choice on an existing article is preserved; FAQs of these articles are replaced.
-- Idempotent + re-runnable. Only runs where the Phase 7 KB tables exist.

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

IF OBJECT_ID(N'dbo.CrmKbArticles', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.CrmKbCategories', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.CrmKbFaqs', N'U') IS NOT NULL
BEGIN
    SET NOCOUNT ON;
    DECLARE @version NVARCHAR(30) = ${q(version)};
    DECLARE @now DATETIME2 = SYSUTCDATETIME();
    DECLARE @categoryId INT;
    DECLARE @articleId UNIQUEIDENTIFIER;
`)

categories.forEach((name, idx) => {
  sql.push(`
    -- Category: ${name}
    IF NOT EXISTS (SELECT 1 FROM dbo.CrmKbCategories WHERE Layer = N'shipped' AND Name = ${q(name)})
        INSERT INTO dbo.CrmKbCategories (Layer, Name, Description, Icon, SortOrder, IsActive)
        VALUES (N'shipped', ${q(name)}, N'Getting a new company live on DFRNT with the Setup Dashboard: each step, the data files, and what the messages mean.', N'settings', ${(idx + 1) * 10}, 1);`)
})

for (const a of articles) {
  sql.push(`
    -- ${a.file}
    SELECT @categoryId = CategoryId FROM dbo.CrmKbCategories WHERE Layer = N'shipped' AND Name = ${q(a.category)};
    MERGE dbo.CrmKbArticles AS t
    USING (SELECT ${q(a.sourceId)} AS SourceId) AS s ON t.SourceId = s.SourceId
    WHEN MATCHED THEN UPDATE SET
        Layer = N'shipped', IsManaged = 1, IsAutoGenerated = 0, Status = N'published',
        CategoryId = @categoryId,
        Title = ${q(a.title)},
        ContentHtml = ${q(a.html)},
        ContentText = ${q(a.text)},
        AudienceCsv = ${q(a.audience)},
        TagsCsv = ${q(a.tags)},
        SourceVersion = @version, SourceDocumentUrl = ${q(a.url)}, LastSyncedDateUtc = @now, LastModifiedDateUtc = @now,
        PublishedDateUtc = COALESCE(t.PublishedDateUtc, @now)
    WHEN NOT MATCHED THEN INSERT
        (Layer, CategoryId, Title, ContentHtml, ContentText, Status, IsAutoGenerated, IsManaged, IsHidden, SourceId, SourceVersion,
         LastSyncedDateUtc, SourceDocumentUrl, AudienceCsv, TagsCsv, CreatedDateUtc, PublishedDateUtc)
        VALUES (N'shipped', @categoryId, ${q(a.title)}, ${q(a.html)}, ${q(a.text)}, N'published', 0, 1, 0, ${q(a.sourceId)}, @version,
         @now, ${q(a.url)}, ${q(a.audience)}, ${q(a.tags)}, @now, @now);

    SELECT @articleId = ArticleId FROM dbo.CrmKbArticles WHERE SourceId = ${q(a.sourceId)};
    DELETE FROM dbo.CrmKbFaqs WHERE ArticleId = @articleId;`)
  const mine = faqs.filter(f => f.sourceId === a.sourceId)
  mine.forEach((f, n) => {
    sql.push(`    INSERT INTO dbo.CrmKbFaqs (ArticleId, Layer, CategoryId, Question, Answer, Status, SortOrder)
    VALUES (@articleId, N'shipped', @categoryId, ${q(f.question)}, ${q(f.answer)}, N'published', ${n + 1});`)
  })
}

sql.push(`
    PRINT 'Shipped KB: ${articles.length} Setup Dashboard articles and ${faqs.length} FAQs upserted (version ' + @version + ')';
END
ELSE
    PRINT 'Shipped KB: CrmKb* tables not present, nothing to do';
GO

SELECT @@ROWCOUNT AS RecordsInserted;
`)

writeFileSync(out, sql.join('\n'))
console.log(`${articles.length} articles, ${faqs.length} FAQs, ${categories.length} category -> ${out} (version ${version}, ${(readFileSync(out).length / 1024).toFixed(0)} KB)`)
