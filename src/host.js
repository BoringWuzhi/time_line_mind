// time_line_mind · DSH Plugin · Host 半区
// 用法:将本文件内容作为 cordis_define 的 code.host(plain JavaScript 函数体)。
// 提供多图档存储(按会话,内存 + 落盘 mindmap-docs.json)、导出到工作区、诊断工具。
return {
  apply(ctx) {
    const stores = new Map()
    const fs = ctx.get('fs')

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
