// 生成 autoload/index.js:把 ../src/host.js 与 ../src/client.js 内联进模板。
// 用法:node autoload/build.js(或 pnpm --dir autoload build)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const host = readFileSync(join(root, 'src', 'host.js'), 'utf8')
const client = readFileSync(join(root, 'src', 'client.js'), 'utf8')
const template = readFileSync(join(here, 'index.template.js'), 'utf8')

const out = template
  // 使用函数形式替换,避免源码中的 `$'`、`$&` 等被 String.replace 当作特殊替换模式。
  .replace('__HOST_SOURCE__', () => JSON.stringify(host))
  .replace('__CLIENT_SOURCE__', () => JSON.stringify(client))

writeFileSync(join(here, 'index.js'), out)
console.log(`autoload/index.js generated (${out.length} bytes)`)
