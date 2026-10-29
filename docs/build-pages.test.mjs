import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { USE_CASES } from '../frontend/src/useCases.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const outputDirectory = resolve(root, '_site')
const expectedHtml = ['index.html', 'blog-post.html', 'fleet-intelligence-slides.html', 'home-shopping.html', 'home-shopping-slides.html', 'THIRD-PARTY-NOTICES.html']
const pages = new Map(await Promise.all(expectedHtml.map(async name => [name, await readFile(resolve(outputDirectory, name), 'utf8')])))

async function filesIn(directory, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name
    assert(!entry.isSymbolicLink(), `Symbolic link in Pages artifact: ${name}`)
    if (entry.isDirectory()) files.push(...await filesIn(resolve(directory, entry.name), `${name}/`))
    else {
      assert(entry.isFile(), `Unsupported artifact entry: ${name}`)
      files.push(name)
    }
  }
  return files
}

const artifactFiles = await filesIn(outputDirectory)
const artifactPaths = new Set(artifactFiles)
const attributes = content => [...content.matchAll(/\b(href|src)="([^"]*)"/g)]
const ids = content => new Set([...content.matchAll(/\bid="([^"]*)"/g)].map(match => match[1]))
const decodeAttribute = value => value.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"')

test('artifact contains only published documents and PNG images', async () => {
  const images = (await readdir(resolve(root, 'docs', 'media'))).filter(name => name.endsWith('.png'))
  assert.deepEqual(artifactFiles.sort(), [...expectedHtml, '.nojekyll', ...images.map(name => `media/${name}`)].sort())
})

test('relative assets and anchors work below a repository Pages path', () => {
  let checked = 0
  for (const [name, content] of pages) {
    for (const [, attribute, raw] of attributes(content)) {
      const value = decodeAttribute(raw)
      assert(!value.startsWith('file:'), `Local filesystem link in ${name}`)
      const url = new URL(value, `https://example.test/horizondb-use-cases/${name}`)
      if (url.origin !== 'https://example.test') continue
      assert(url.pathname.startsWith('/horizondb-use-cases/'), `Link escapes Pages base: ${name}: ${value}`)
      const target = decodeURIComponent(url.pathname.slice('/horizondb-use-cases/'.length))
      assert(artifactPaths.has(target), `Missing ${attribute} target: ${name}: ${value}`)
      if (url.hash && pages.has(target)) {
        assert(ids(pages.get(target)).has(decodeURIComponent(url.hash.slice(1))), `Missing anchor: ${name}: ${value}`)
      }
      checked++
    }
  }
  assert(checked > 30, 'Expected documentation, presentation, image and navigation links')
})

test('landing uses shared cases and directs readers to install their own application', () => {
  const landing = pages.get('index.html')
  for (const useCase of USE_CASES) {
    assert(landing.includes(useCase.title))
    assert(landing.includes(useCase.question))
    assert(landing.includes(`href="${useCase.documentation}"`))
    assert(landing.includes(`href="${useCase.presentation}"`))
  }
  assert(landing.includes('실제 모델 추론은 연결된 외부 endpoint에서 실행됩니다.'))
  assert(landing.includes('이 Pages 사이트는 소개와 문서만 제공합니다.'))
  assert(landing.includes('각자의 Azure 환경에 HorizonDB·모델·앱을 구성해 실행합니다.'))
  assert(landing.includes('공유 데모 접속 주소는 제공하지 않습니다.'))
  assert(landing.includes('/blob/main/README.md#로컬-실행'))
  assert(!/\b(?:fetch|XMLHttpRequest|EventSource|WebSocket)\s*\(/.test(landing))
  assert(!landing.includes('/api/'))
})

test('published documents do not expose an operational demo endpoint', () => {
  for (const [name, content] of pages) {
    assert(!/https:\/\/[a-z0-9.-]+\.azurecontainerapps\.io/i.test(content), `Operational demo endpoint in ${name}`)
  }
})

test('repository source links are public URLs rather than missing Pages files', () => {
  const repository = process.env.GITHUB_REPOSITORY ?? 'kyungtaak/horizondb-use-cases'
  let sourceLinks = 0
  for (const [name, content] of pages) {
    for (const [, attribute, raw] of attributes(content)) {
      if (attribute !== 'href') continue
      const value = decodeAttribute(raw)
      if (/\.(?:md|py|ps1|bicep|sql|tsx?|json|yaml)(?:#|$)/.test(value)) {
        assert(value.startsWith(`https://github.com/${repository}/blob/main/`), `Unpublished source link in ${name}: ${value}`)
        sourceLinks++
      }
      assert(!value.includes(root.split(sep).join('/')), `Workstation path in ${name}`)
    }
  }
  assert(sourceLinks > 10, 'Expected source references in the published guides')
})
