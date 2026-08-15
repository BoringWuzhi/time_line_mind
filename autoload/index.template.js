// time_line_mind 自动重载器 —— 模板。
// 由 build.js 读取 ../src/host.js 与 ../src/client.js,替换占位符生成 index.js。
// 本文件不直接运行;请勿手工编辑生成的 index.js。
//
// 策略:进程级单实例。整个 DSH 进程只恢复一个 time_line_mind 实例,
// 挂在第一个出现的用户会话下(DSH 动态插件 API 强制实例归属某个会话,
// 但数据在 host 侧按 'default' key 全局共享、UI 全局注册,行为等价于进程级)。

const HOST_SOURCE = __HOST_SOURCE__
const CLIENT_SOURCE = __CLIENT_SOURCE__

const ID_PREFIX = 'mindm'
const PLUGIN_NAME = 'time_line_mind'
const PLUGIN_PURPOSE = '无向图思维导图编辑器(网络图+时间轴,DSH 动态插件自动恢复)'

export const name = 'time-line-mind-autoload'

export const inject = ['dynamicCordisRunner', 'agents']

/** 进程级标志:本进程已恢复(或已存在)实例后,不再为任何会话恢复第二个。 */
let restoredOnce = false

async function restoreOnce(ctx, agent) {
  if (restoredOnce) return
  const runner = ctx.get('dynamicCordisRunner')
  if (!runner || !agent || typeof agent.id !== 'string') return

  // 本进程已存在该插件的定义(例如用户已手动加载)则标记并跳过,避免重复。
  try {
    const rows = runner.snapshot(agent)
    if (Array.isArray(rows) && rows.some((r) => r && typeof r.pluginId === 'string' && r.pluginId.startsWith(ID_PREFIX + '-'))) {
      console.log(`[time-line-mind-autoload] ${agent.id}: already defined, skip`)
      restoredOnce = true
      return
    }
  } catch (err) {
    console.warn('[time-line-mind-autoload] snapshot failed, continue', err)
  }

  let receipt
  try {
    receipt = runner.define({
      sessionId: agent.id,
      plugin: { kind: 'new', idPrefix: ID_PREFIX },
      name: PLUGIN_NAME,
      purpose: PLUGIN_PURPOSE,
      code: { host: HOST_SOURCE, client: CLIENT_SOURCE },
    })
  } catch (err) {
    // define 失败不置位:允许后续会话重试。
    console.error(`[time-line-mind-autoload] ${agent.id}: define failed`, err)
    return
  }
  restoredOnce = true

  try {
    const res = await runner.run(agent, receipt.pluginId, receipt.packageId, 'run')
    if (res && res.ok) {
      console.log(`[time-line-mind-autoload] ${agent.id}: ${receipt.pluginId} → ${res.status || 'started'}`)
    } else {
      console.error(`[time-line-mind-autoload] ${agent.id}: run failed`, res)
    }
  } catch (err) {
    console.error(`[time-line-mind-autoload] ${agent.id}: run failed`, err)
  }
}

export function apply(ctx) {
  const agents = ctx.get('agents')
  if (!agents) return

  const restoreFor = (agent) => {
    restoreOnce(ctx, agent).catch((err) => console.error('[time-line-mind-autoload] restore error', err))
  }

  const sweep = () => {
    let list
    try {
      list = agents.list()
    } catch (err) {
      console.warn('[time-line-mind-autoload] agents.list failed', err)
      return
    }
    if (!Array.isArray(list)) return
    // 进程级单实例:只让第一个可用会话触发恢复,其余由 restoredOnce 短路。
    for (const agent of list) {
      restoreFor(agent)
      if (restoredOnce) break
    }
  }

  // 启动时已存在的会话(apply 前已创建)。
  sweep()

  // 之后创建/恢复的会话。session/created 是 scoped 事件,须 global 监听;
  // 跳过子代理会话(parentSession 存在),只考虑用户会话。
  ctx.on(
    'session/created',
    (session) => {
      if (restoredOnce || !session || session.parentSession !== undefined) return
      const agent = agents.get(session.id)
      if (agent) {
        restoreFor(agent)
      } else {
        // 事件可能早于 agent 注册,稍后重试一次。
        setTimeout(() => {
          const again = agents.get(session.id)
          if (again) restoreFor(again)
        }, 500)
      }
    },
    { global: true },
  )
}
