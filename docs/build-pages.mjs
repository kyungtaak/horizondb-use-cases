import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { USE_CASES } from '../frontend/src/useCases.ts'
import { escape, renderArticleDocument, renderDocument } from './build-docs.mjs'
import { createPagesDocument } from './pages-template.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const root = resolve(directory, '..')
const outputDirectory = resolve(root, '_site')
const checking = process.argv.includes('--check')
const repository = process.env.GITHUB_REPOSITORY ?? 'kyungtaak/horizondb-use-cases'
assert.match(repository, /^[\w.-]+\/[\w.-]+$/, 'Invalid GitHub repository name')
const repositoryUrl = `https://github.com/${repository}`
const installationUrl = `${repositoryUrl}/blob/main/README.md#로컬-실행`
const read = async name => (await readFile(resolve(directory, name), 'utf8')).replace(/\r\n/g, '\n')

const generated = new Map([
  ['index.html', createPagesDocument({ cases: USE_CASES, escape, renderDocument, repositoryUrl, installationUrl })],
  ['home-shopping.html', renderArticleDocument(await read('home-shopping.md'), {
    title: 'Home Shopping Intelligence | 구성과 검증',
    brand: 'Home Shopping Intelligence',
    href: 'home-shopping-slides.html',
  })],
  ['THIRD-PARTY-NOTICES.html', renderArticleDocument(await read('THIRD-PARTY-NOTICES.md'), {
    title: 'HorizonDB Use Cases | 출처와 라이선스',
    brand: '출처와 라이선스',
    href: 'index.html',
    meta: '참고 프로젝트와 원본 라이선스',
  })],
])

for (const [name, content] of generated) {
  if (checking) assert.equal(await read(name), content, `${name} is stale; run node docs/build-pages.mjs`)
  else await writeFile(resolve(directory, name), content, 'utf8')
}

const htmlFiles = [...generated.keys(), 'blog-post.html', 'fleet-intelligence-slides.html', 'home-shopping-slides.html']
const published = new Map(htmlFiles.map(name => [resolve(directory, name), name]))
const images = (await readdir(resolve(directory, 'media'), { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.png'))
for (const image of images) published.set(resolve(directory, 'media', image.name), `media/${image.name}`)

function publicLinks(content, sourcePath) {
  return content.replace(/\b(href|src)="([^"]*)"/g, (match, attribute, value) => {
    if (!value || /^(?:#|https?:|mailto:|tel:|data:|\/\/)/i.test(value)) return match
    const url = new URL(value.replaceAll('&amp;', '&'), pathToFileURL(sourcePath))
    assert.equal(url.protocol, 'file:', `Unsupported link protocol in ${sourcePath}`)
    const target = fileURLToPath(url)
    if (published.has(target)) return `${attribute}="${escape(published.get(target) + url.search + url.hash)}"`
    assert(existsSync(target), `Missing local target in ${sourcePath}: ${value}`)
    assert.equal(attribute, 'href', `Asset is not included in Pages output: ${value}`)
    const targetPath = relative(root, target)
    assert(targetPath !== '..' && !targetPath.startsWith(`..${sep}`) && !isAbsolute(targetPath), `Link leaves the repository: ${value}`)
    const kind = statSync(target).isDirectory() ? 'tree' : 'blob'
    const encoded = targetPath.split(sep).map(encodeURIComponent).join('/')
    return `href="${escape(`${repositoryUrl}/${kind}/main/${encoded}${url.hash}`)}"`
  })
}

for (const useCase of USE_CASES) {
  assert(htmlFiles.includes(useCase.documentation), `Missing documentation for ${useCase.id}`)
  assert(htmlFiles.includes(useCase.presentation), `Missing presentation for ${useCase.id}`)
}

const pages = new Map()
for (const name of htmlFiles) {
  const sourcePath = resolve(directory, name)
  await access(sourcePath)
  pages.set(name, publicLinks(await read(name), sourcePath))
}

if (!checking) {
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(resolve(outputDirectory, 'media'), { recursive: true })
  for (const [name, content] of pages) await writeFile(resolve(outputDirectory, name), content, 'utf8')
  for (const image of images) await copyFile(resolve(directory, 'media', image.name), resolve(outputDirectory, 'media', image.name))
  await writeFile(resolve(outputDirectory, '.nojekyll'), '', 'utf8')
}

console.log(`${checking ? 'Verified' : 'Built'} Pages site: ${pages.size} HTML documents, ${images.length} images; static content only.`)
