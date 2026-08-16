// time_line_mind · DSH Plugin · Host 半区
// 用法:将本文件内容作为 cordis_define 的 code.host(plain JavaScript 函数体)。
// 提供多图档存储(按会话,内存 + 落盘 mindmap-docs.json)、导出到工作区、诊断工具。
return {
  apply(ctx) {
    const stores = new Map()
    const fs = ctx.get('fs')
    const llm = ctx.get('llm')

    function genId() {
      return 'n' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
    }

    const keyOf = (args) => (args && typeof args.sessionId === 'string' ? args.sessionId : 'default')

    function ensureDocs(key) {
      let rec = stores.get(key)
      if (!rec) {
        const first = { id: 'doc-' + Math.random().toString(36).slice(2, 8), name: '未命名图像', graph: { nodes: [{ id: 'root', title: '中心主题' }], edges: [], groups: [] }, layout: null }
        rec = { docs: [first] }
        stores.set(key, rec)
      }
      return rec.docs
    }

    async function persist(key) {
      if (!fs) return
      try {
        const target = await fs.resolve('mindmap-docs.json')
        await fs.writeText(target, JSON.stringify(stores.get(key).docs))
      } catch (err) {
        console.error('mindmap persist failed', err)
      }
    }

    async function loadPersisted(key) {
      if (!fs) return null
      try {
        const target = await fs.resolve('mindmap-docs.json')
        const info = await fs.stat(target)
        if (!info) return null
        const text = await fs.readText(target)
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch (err) {
        return null
      }
      return null
    }

    // ===== 模型推理辅助:用 LLM 从文档中抽取时间线与关系 =====
    async function resolveModelSelection() {
      if (!llm) return null
      try {
        const adm = ctx.get('agentDefaultModel')
        if (adm && typeof adm.currentSelection === 'function') {
          const sel = adm.currentSelection()
          if (sel && sel.provider && sel.model) {
            return { provider: sel.provider, model: sel.model }
          }
        }
      } catch (err) {
        console.warn('[time_line_mind] agentDefaultModel unavailable', err)
      }
      try {
        const providers = llm.listProviders()
        if (providers.length === 0) return null
        const provider = providers[0].id
        const models = await llm.listModels(provider)
        if (models.length > 0) return { provider, model: models[0].id }
        return null
      } catch (err) {
        console.warn('[time_line_mind] resolve model failed', err)
        return null
      }
    }

    async function completeWithModel(system, userPrompt) {
      const model = await resolveModelSelection()
      if (!model) return { ok: false, error: 'NO_MODEL', message: '当前环境没有可用的 LLM provider/model' }
      const messages = [{
        id: 'msg-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'user',
        content: [{ type: 'text', text: userPrompt }],
        source: { kind: 'user' },
      }]
      let text = ''
      let finishFailure = null
      try {
        for await (const chunk of llm.stream({
          provider: model.provider,
          model: model.model,
          messages,
          system,
          temperature: 0,
          maxTokens: 4000,
        })) {
          if (chunk.type === 'text-delta') text += chunk.text
          else if (chunk.type === 'block-end' && chunk.block && chunk.block.type === 'text') text += chunk.block.text
          else if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
            finishFailure = chunk.reason.failure ? chunk.reason.failure.message : 'model stream failed'
          }
        }
      } catch (err) {
        return { ok: false, error: 'LLM_CALL_FAILED', message: err && err.message ? String(err.message) : String(err) }
      }
      if (finishFailure) return { ok: false, error: 'LLM_FINISH_FAILED', message: finishFailure }
      if (!text.trim()) return { ok: false, error: 'EMPTY_RESPONSE', message: '模型返回为空' }
      return { ok: true, text, model }
    }

    function extractJsonFromLlm(text) {
      let s = String(text || '').trim()
      const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
      if (fence) s = fence[1].trim()
      const start = s.indexOf('{')
      const end = s.lastIndexOf('}')
      if (start >= 0 && end > start) s = s.slice(start, end + 1)
      try {
        return JSON.parse(s)
      } catch (err) {
        return null
      }
    }

    function parseAiDate(s) {
      const text = String(s || '').trim()
      if (!text) return undefined
      const m = text.match(/^(\d{4})\s*[-\/.年]\s*(\d{1,2})\s*[-\/.月]\s*(\d{1,2})\s*日?(?:\s+(\d{1,2})[:：](\d{2}))?/)
      if (m) {
        const date = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0)
        if (!isNaN(date.getTime())) return date.getTime()
      }
      const ts = Date.parse(text)
      return isNaN(ts) ? undefined : ts
    }

    function normalizeAiGraph(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.nodes)) return null
      const seen = new Set()
      const nodes = []
      for (const n of input.nodes) {
        if (!n || typeof n !== 'object') continue
        const id = typeof n.id === 'string' && n.id ? n.id : null
        const title = typeof n.title === 'string' && n.title.trim()
          ? n.title.trim()
          : (typeof n.name === 'string' && n.name.trim() ? n.name.trim() : null)
        if (!id || !title || seen.has(id)) continue
        seen.add(id)
        const node = { id, title }
        let time
        if (typeof n.time === 'number' && isFinite(n.time)) time = n.time
        else if (typeof n.date === 'string' && n.date.trim()) time = parseAiDate(n.date)
        else if (typeof n.dateText === 'string' && n.dateText.trim()) time = parseAiDate(n.dateText)
        if (time !== undefined && !isNaN(time)) node.time = time
        nodes.push(node)
      }
      if (nodes.length === 0) return null
      const edges = []
      if (Array.isArray(input.edges)) {
        for (const e of input.edges) {
          if (!e || typeof e !== 'object') continue
          const s = e.source
          const t = e.target
          if (typeof s === 'string' && typeof t === 'string' && seen.has(s) && seen.has(t) && s !== t) {
            const edge = { source: s, target: t }
            const title = typeof e.title === 'string' && e.title.trim()
              ? e.title.trim()
              : (typeof e.relation === 'string' && e.relation.trim() ? e.relation.trim() : '')
            if (title) edge.title = title
            edges.push(edge)
          }
        }
      }
      const groups = []
      if (Array.isArray(input.groups)) {
        for (const gr of input.groups) {
          if (!gr || typeof gr !== 'object') continue
          const name = typeof gr.name === 'string' && gr.name.trim() ? gr.name.trim() : '网络团'
          const nodeIds = Array.isArray(gr.nodeIds)
            ? gr.nodeIds.filter((x) => typeof x === 'string' && seen.has(x))
            : []
          if (nodeIds.length > 0) groups.push({
            id: typeof gr.id === 'string' && gr.id ? gr.id : genId(),
            name,
            nodeIds,
            pinned: gr.pinned === true,
          })
        }
      }
      return { nodes, edges, groups }
    }

    const AI_SYSTEM_PROMPT = '你是一个资深的信息抽取与关系图谱专家。你的任务是从文档中提取完整、准确、可渲染的思维导图数据，重点分析并输出以下关系：\n'
      + '1. 人物关系：合作、对立、亲属、上下级、认识、朋友、师徒、支持、反对等；\n'
      + '2. 事件关系：因果、先后、包含、推动、阻碍、转折、相关等；\n'
      + '3. 时间关系：早于、晚于、同期、持续、开始、结束等；\n'
      + '4. 组织/概念关系：属于、包含、影响、依赖、支持、反对等。\n'
      + '\n'
      + '输出 JSON 结构：\n'
      + '{\n'
      + '  "nodes": [ { "id": "唯一id", "title": "节点标题", "date": "可选日期", "type": "person|event|organization|place|concept" } ],\n'
      + '  "edges": [ { "source": "节点id", "target": "节点id", "title": "具体关系词", "type": "人物关系|事件关系|时间关系|组织概念关系" } ],\n'
      + '  "groups": [ { "name": "分组名", "nodeIds": ["节点id"] } ]\n'
      + '}\n'
      + '\n'
      + '要求：\n'
      + '- 先通读全文，识别所有核心实体和事件，不要遗漏关键人物、组织、事件、时间节点；\n'
      + '- 每个核心实体/事件都进入 nodes；带明确日期的事件必须写 date；\n'
      + '- 不要只输出孤立的节点，必须把文本中存在或可明确推断的关系全部输出为 edges；\n'
      + '- 关系标题必须具体且能体现语义，禁止使用“相关”“有关”这类模糊词；\n'
      + '- 所有 edge 的 source/target 必须引用 nodes 中存在的 id；\n'
      + '- groups 用于把同一章节/主题/项目下的节点归组；\n'
      + '- 只输出 JSON，不要输出 Markdown 代码块以外的任何说明；\n'
      + '- 不要编造文档中不存在的信息。'

    function buildAiParsePrompt(text, fileName) {
      const name = fileName ? String(fileName) : '未命名文件'
      const body = String(text || '').slice(0, 30000)
      return '文件名称：' + name + '\n\n文档内容：\n' + body
    }

    async function aiParseText(text, fileName) {
      const result = await completeWithModel(AI_SYSTEM_PROMPT, buildAiParsePrompt(text, fileName))
      if (!result.ok) return result
      const data = extractJsonFromLlm(result.text)
      const graph = data ? normalizeAiGraph(data) : null
      if (!graph) {
        return { ok: false, error: 'AI_PARSE_FAILED', message: '模型输出无法解析为图结构', raw: String(result.text).slice(0, 1000) }
      }
      const timed = graph.nodes.filter((n) => n.time !== undefined).length
      return {
        ok: true,
        graph,
        model: result.model,
        stats: { nodes: graph.nodes.length, timed, edges: graph.edges.length, groups: graph.groups.length },
      }
    }

    harness.handle('mindmap/load', async (args) => {
      const key = keyOf(args)
      const persisted = await loadPersisted(key)
      if (persisted) {
        stores.set(key, { docs: persisted })
        return { docs: persisted }
      }
      const docs = ensureDocs(key)
      return { docs }
    })

    harness.handle('mindmap/save', async (args) => {
      const key = keyOf(args)
      const docs = ensureDocs(key)
      const id = args && args.docId
      let idx = docs.findIndex((d) => d.id === id)
      if (idx === -1) {
        if (args && args.graph) {
          docs.push({
            id: id || 'doc-' + Math.random().toString(36).slice(2, 8),
            name: (args && args.name) || '未命名图像',
            graph: args.graph,
            layout: (args && args.layout) || null,
          })
        } else {
          return { ok: false, error: 'unknown docId' }
        }
      } else {
        if (args && args.graph !== undefined) docs[idx] = { ...docs[idx], graph: args.graph }
        if (args && args.layout !== undefined) docs[idx] = { ...docs[idx], layout: args.layout }
        if (args && args.name !== undefined) docs[idx] = { ...docs[idx], name: args.name }
      }
      await persist(key)
      return { ok: true }
    })

    harness.handle('mindmap/doc/create', async (args) => {
      const key = keyOf(args)
      const docs = ensureDocs(key)
      const id = 'doc-' + Math.random().toString(36).slice(2, 8)
      docs.push({ id, name: (args && args.name) || '未命名图像', graph: { nodes: [{ id: 'root', title: '中心主题' }], edges: [], groups: [] }, layout: null })
      await persist(key)
      return { ok: true, docId: id }
    })

    harness.handle('mindmap/doc/delete', async (args) => {
      const key = keyOf(args)
      const docs = ensureDocs(key)
      const id = args && args.docId
      const next = docs.filter((d) => d.id !== id)
      if (next.length === 0) {
        next.push({ id: 'doc-' + Math.random().toString(36).slice(2, 8), name: '未命名图像', graph: { nodes: [{ id: 'root', title: '中心主题' }], edges: [], groups: [] }, layout: null })
      }
      stores.get(key).docs = next
      await persist(key)
      return { ok: true }
    })

    harness.handle('mindmap/doc/duplicate', async (args) => {
      const key = keyOf(args)
      const docs = ensureDocs(key)
      const id = args && args.docId
      const src = docs.find((d) => d.id === id)
      if (!src) return { ok: false, error: 'unknown docId' }
      const nid = 'doc-' + Math.random().toString(36).slice(2, 8)
      docs.push({
        id: nid,
        name: src.name + ' 副本',
        graph: JSON.parse(JSON.stringify(src.graph)),
        layout: src.layout ? JSON.parse(JSON.stringify(src.layout)) : null,
      })
      await persist(key)
      return { ok: true, docId: nid }
    })

    harness.handle('mindmap/doc/import', async (args) => {
      const key = keyOf(args)
      const docs = ensureDocs(key)
      const id = 'doc-' + Math.random().toString(36).slice(2, 8)
      docs.push({
        id,
        name: (args && args.name) || '导入图像',
        graph: args && args.graph ? args.graph : { nodes: [{ id: 'root', title: '中心主题' }], edges: [], groups: [] },
        layout: args && args.layout ? args.layout : null,
      })
      await persist(key)
      return { ok: true, docId: id }
    })

    harness.handle('mindmap/ai-parse', async (args) => {
      const text = args && typeof args.text === 'string' ? args.text : ''
      const fileName = args && typeof args.fileName === 'string' ? args.fileName : ''
      if (!text.trim()) return { ok: false, error: 'EMPTY_TEXT', message: '没有可解析的文本' }
      try {
        return await aiParseText(text, fileName)
      } catch (err) {
        return { ok: false, error: 'AI_PARSE_EXCEPTION', message: err && err.message ? String(err.message) : String(err) }
      }
    })

    harness.handle('mindmap/export-data', async (args) => {
      const key = keyOf(args)
      const docs = ensureDocs(key)
      const doc = docs.find((d) => d.id === (args && args.docId))
      if (!doc) return { ok: false, error: 'unknown docId' }
      if (!fs) return { ok: false, error: 'fs unavailable' }
      const safe = String(doc.name || 'mindmap').replace(/[\\/:*?"<>|]/g, '_')
      const payload = { name: doc.name, graph: doc.graph }
      if (doc.layout) payload.layout = doc.layout
      const target = await fs.resolve('mindmap-export-' + safe + '.json')
      await fs.writeText(target, JSON.stringify(payload, null, 2))
      return { ok: true, path: 'mindmap-export-' + safe + '.json' }
    })

    harness.handle('mindmap/export-image', async (args) => {
      if (!fs) return { ok: false, error: 'fs unavailable' }
      const safe = String(args && args.name || 'mindmap').replace(/[\\/:*?"<>|]/g, '_')
      const target = await fs.resolve('mindmap-export-' + safe + '.svg')
      await fs.writeText(target, String(args && args.svg || ''))
      return { ok: true, path: 'mindmap-export-' + safe + '.svg' }
    })

    harness.handle('mindmap/reset', async (args) => {
      stores.delete(keyOf(args))
      return { ok: true }
    })

    // 诊断工具:读取浏览器端加载/渲染失败信息(排查 UI 空白用)
    const diagTool = harness.defineTool({
      name: 'mindmap_diag',
      description: '读取思维导图插件的浏览器端加载/渲染诊断:loaded 状态与 renderFailure(渲染崩溃的 slot 与错误消息)。供排查插件 UI 空白问题时使用。',
      parameters: { type: 'object', properties: {}, additionalProperties: true },
      output: {
        schema: { type: 'object', properties: {}, additionalProperties: true },
        render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      execute: async (args, exec) => {
        try {
          const runner = ctx.get('dynamicCordisRunner')
          if (!runner || typeof runner.snapshot !== 'function') {
            return { ok: false, reason: 'dynamicCordisRunner unavailable in this context' }
          }
          const agent = exec && exec.agent ? exec.agent : undefined
          if (agent === undefined) {
            return { ok: false, reason: 'no agent in exec context' }
          }
          const rows = runner.snapshot(agent) || []
          return {
            ok: true,
            rows: rows.map((row) => ({
              pluginId: row && row.pluginId ? row.pluginId : null,
              currentPackageId: row && row.currentPackageId ? row.currentPackageId : null,
              nextPackageId: row && row.nextPackageId ? row.nextPackageId : null,
              activeRun: row && row.activeRun
                ? {
                    packageId: row.activeRun.packageId || null,
                    pluginRunId: row.activeRun.pluginRunId || null,
                    renderFailure: row.activeRun.renderFailure
                      ? {
                          slot: row.activeRun.renderFailure.slot || null,
                          message: row.activeRun.renderFailure.message || null,
                          abdicated: !!row.activeRun.renderFailure.abdicated,
                        }
                      : null,
                  }
                : null,
            })),
          }
        } catch (err) {
          return { ok: false, error: err && err.message ? String(err.message) : String(err) }
        }
      },
    })
    harness.registerTool(ctx, diagTool)

    // 阶段一预留:mindmap 工具(对话流渲染)的图规范化
    const normalizeGraph = (input) => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return null
      if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) return null
      const seen = new Set()
      const nodes = []
      for (const n of input.nodes) {
        if (!n || typeof n !== 'object') continue
        const id = typeof n.id === 'string' && n.id ? n.id : null
        if (id === null || seen.has(id)) continue
        seen.add(id)
        const node = { id, title: typeof n.title === 'string' && n.title.trim() ? n.title.trim() : '未命名' }
        if (typeof n.time === 'number' && isFinite(n.time)) node.time = n.time
        nodes.push(node)
      }
      const edges = []
      for (const e of input.edges) {
        if (!e || typeof e !== 'object') continue
        const s = e.source
        const t = e.target
        if (typeof s === 'string' && typeof t === 'string' && seen.has(s) && seen.has(t) && s !== t) {
          const edge = { source: s, target: t }
          if (typeof e.title === 'string' && e.title.trim()) edge.title = e.title.trim()
          edges.push(edge)
        }
      }
      if (nodes.length === 0) return null
      const groups = []
      if (Array.isArray(input.groups)) {
        for (const gr of input.groups) {
          if (!gr || typeof gr !== 'object') continue
          const name = typeof gr.name === 'string' && gr.name.trim() ? gr.name.trim() : '网络团'
          const nodeIds = Array.isArray(gr.nodeIds)
            ? gr.nodeIds.filter((x) => typeof x === 'string' && seen.has(x))
            : []
          if (nodeIds.length > 0) groups.push({
            id: typeof gr.id === 'string' && gr.id ? gr.id : genId(),
            name,
            nodeIds,
            pinned: gr.pinned === true,
          })
        }
      }
      return { nodes, edges, groups }
    }
    void normalizeGraph
  },
}
