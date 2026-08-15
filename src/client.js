// time_line_mind · DSH Plugin · Client 半区
// 用法:将本文件内容作为 cordis_define 的 code.client(plain JavaScript 函数体)。
// 提供编辑器 UI:无向图网络 + 时间轴 + 多图档 + 网络团 + 雾团 + 导入导出。
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const store = {
      open: false,
      listeners: [],
      setOpen(v) {
        if (this.open === v) return
        this.open = v
        this.listeners.slice().forEach((fn) => fn())
      },
      subscribe(fn) {
        this.listeners.push(fn)
        return () => {
          const i = this.listeners.indexOf(fn)
          if (i >= 0) this.listeners.splice(i, 1)
        }
      },
    }

    function useOpen() {
      const [open, setOpen] = React.useState(store.open)
      React.useEffect(() => store.subscribe(() => setOpen(store.open)), [])
      return [open, (v) => store.setOpen(v)]
    }

    function errText(err) {
      if (err && err.message) return String(err.message)
      try { return String(err) } catch (e2) { return 'unknown error' }
    }
    function crashView(err, label) {
      return React.createElement('div', {
        style: { color: '#e05252', fontSize: 12, padding: 8, border: '1px dashed #e05252', borderRadius: 6, fontFamily: 'system-ui, sans-serif' },
      }, label + ': ' + errText(err))
    }

    styles.insert(`\n.mm-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);pointer-events:auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;}\n.mm-panel{display:flex;flex-direction:column;width:min(1280px,96vw);height:min(780px,92vh);border-radius:12px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.35);background:#f7f8fa;color:#1f2328;}\n@media (prefers-color-scheme:dark){.mm-panel{background:#202127;color:#e8eaee;}}\n.mm-panel-head{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid rgba(127,127,127,.25);}\n.mm-title{font-size:15px;font-weight:600;}\n.mm-save-state{font-size:12px;opacity:.65;}\n.mm-close{margin-left:auto;border:none;background:transparent;cursor:pointer;font-size:15px;color:inherit;padding:4px 8px;border-radius:6px;}\n.mm-close:hover{background:rgba(127,127,127,.18);}\n.mm-toolbar{display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid rgba(127,127,127,.18);flex-wrap:wrap;}\n.mm-tbtn{border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;border-radius:6px;padding:4px 10px;font-size:12.5px;cursor:pointer;}\n.mm-tbtn:hover:not(:disabled){background:rgba(127,127,127,.15);}\n.mm-tbtn:disabled{opacity:.4;cursor:default;}\n.mm-tbtn.active{border-color:#4f8ef7;background:rgba(79,142,247,.18);}\n.mm-sep{width:1px;height:18px;background:rgba(127,127,127,.3);margin:0 4px;}\n.mm-stats{margin-left:auto;font-size:12px;opacity:.65;}\n.mm-timeline{flex:none;height:84px;position:relative;border-bottom:1px solid rgba(127,127,127,.18);overflow-x:auto;overflow-y:hidden;}\n.mm-tl-track{position:relative;height:84px;min-width:100%;}\n.mm-tl-line{position:absolute;left:12px;right:12px;top:34px;height:2px;background:rgba(127,127,127,.45);border-radius:1px;}\n.mm-tl-node{position:absolute;top:16px;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;box-shadow:0 2px 5px rgba(0,0,0,.25);cursor:pointer;box-sizing:border-box;user-select:none;overflow:hidden;transform:translateX(-50%);}\n.mm-tl-node.selected{outline:3px solid rgba(255,255,255,.9);outline-offset:2px;box-shadow:0 0 0 4px rgba(80,140,255,.55);}\n.mm-tl-label{position:absolute;top:58px;font-size:11px;color:inherit;opacity:.85;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transform:translateX(-50%);pointer-events:none;}\n.mm-tl-input{position:absolute;top:15px;width:120px;height:28px;border:none;outline:none;background:#fff;color:#111;border-radius:14px;padding:0 10px;font-size:11px;box-sizing:border-box;transform:translateX(-50%);z-index:6;}\n.mm-canvas{flex:1;position:relative;overflow:hidden;touch-action:none;cursor:grab;background-image:radial-gradient(circle,rgba(127,127,127,.18) 1px,transparent 1px);background-size:22px 22px;}\n@media (prefers-color-scheme:dark){.mm-canvas{background-image:radial-gradient(circle,rgba(255,255,255,.1) 1px,transparent 1px);}}\n.mm-canvas:active{cursor:grabbing;}\n.mm-viewport{position:absolute;left:0;top:0;transform-origin:0 0;}\n.mm-svg{pointer-events:none;position:absolute;left:0;top:0;overflow:visible;}\n.mm-edge{stroke:#9aa3ad;stroke-width:2;}\n.mm-edge-hit{stroke:transparent;stroke-width:14;pointer-events:stroke;cursor:pointer;}\n.mm-edge.link{stroke:#4f8ef7;stroke-width:3;}\n.mm-edge.selected{stroke:#4f8ef7;stroke-width:3;}\n.mm-elabel{position:absolute;transform:translate(-50%,-50%);font-size:11px;background:rgba(20,24,30,.78);color:#fff;border-radius:8px;padding:1px 8px;white-space:nowrap;cursor:pointer;pointer-events:auto;max-width:160px;overflow:hidden;text-overflow:ellipsis;z-index:4;}\n.mm-elabel.selected{background:#4f8ef7;}\n.mm-elabel-input{position:absolute;transform:translate(-50%,-50%);width:150px;font-size:11px;border:none;outline:none;background:#fff;color:#111;border-radius:8px;padding:3px 8px;box-sizing:border-box;z-index:7;}\n.mm-node{position:absolute;display:flex;align-items:center;justify-content:center;padding:0 14px;border-radius:18px;color:#fff;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.22);cursor:pointer;box-sizing:border-box;user-select:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:44px;}\n.mm-node.selected{outline:3px solid rgba(255,255,255,.9);outline-offset:2px;box-shadow:0 0 0 4px rgba(80,140,255,.55);}\n.mm-node.linking{box-shadow:0 0 0 4px rgba(240,163,58,.6);}\n.mm-node.timed{border:2px dashed rgba(255,255,255,.7);}\n.mm-node-input{width:100%;height:100%;border:none;outline:none;background:#fff;color:#111;border-radius:18px;padding:0 12px;font-size:13px;box-sizing:border-box;}\n.mm-node.mm-editing{background:transparent;box-shadow:none;}\n.mm-fog{position:absolute;transform:translate(-50%,-50%);font-size:13px;font-weight:600;background:rgba(60,70,90,.88);color:#fff;border-radius:16px;padding:6px 14px;white-space:nowrap;cursor:pointer;pointer-events:auto;box-shadow:0 3px 10px rgba(0,0,0,.3);z-index:8;}\n.mm-fog:hover{background:rgba(79,142,247,.9);}\n.mm-hint{position:absolute;left:12px;top:10px;z-index:5;font-size:12px;color:rgba(127,127,127,.9);background:rgba(127,127,127,.12);padding:4px 10px;border-radius:10px;pointer-events:none;}\n.mm-ctxmenu{position:absolute;z-index:30;min-width:150px;background:#ffffff;color:#1f2328;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);padding:4px;font-size:13px;}\n@media (prefers-color-scheme:dark){.mm-ctxmenu{background:#2a2c33;color:#e8eaee;}}\n.mm-ctxitem{padding:6px 12px;border-radius:6px;cursor:pointer;white-space:nowrap;}\n.mm-ctxitem:hover:not(.disabled){background:rgba(79,142,247,.16);}\n.mm-ctxitem.disabled{opacity:.35;cursor:default;}\n.mm-namegroup{position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:40;width:240px;height:32px;border:1px solid #4f8ef7;outline:none;background:#fff;color:#111;border-radius:16px;padding:0 14px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.2);}\n.mm-docs{flex:none;width:180px;border-right:1px solid rgba(127,127,127,.2);overflow-y:auto;padding:10px 8px;display:flex;flex-direction:column;gap:6px;}\n.mm-docs-title{font-size:12px;font-weight:600;opacity:.7;}\n.mm-doc-card{border:1px solid rgba(127,127,127,.3);border-radius:10px;padding:6px 8px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:6px;}\n.mm-doc-card:hover{background:rgba(79,142,247,.1);}\n.mm-doc-card.active{background:rgba(79,142,247,.2);border-color:#4f8ef7;}\n.mm-doc-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.mm-doc-btn{border:none;background:transparent;color:inherit;cursor:pointer;opacity:.6;font-size:12px;padding:0 2px;}\n.mm-doc-btn:hover{opacity:1;}\n.mm-doc-actions{display:flex;gap:4px;margin-top:4px;}\n.mm-dact{flex:1;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;border-radius:6px;padding:2px 4px;font-size:11px;cursor:pointer;}\n.mm-dact:hover{background:rgba(127,127,127,.14);}\n.mm-groups{flex:none;width:190px;border-left:1px solid rgba(127,127,127,.2);overflow-y:auto;padding:10px 8px;display:flex;flex-direction:column;gap:8px;}\n.mm-groups-title{font-size:12px;font-weight:600;opacity:.7;margin-bottom:2px;}\n.mm-group-card{border:1px solid rgba(127,127,127,.3);border-radius:10px;padding:6px 8px;font-size:12px;}\n.mm-group-head{display:flex;align-items:center;gap:6px;cursor:pointer;}\n.mm-group-head:hover{background:rgba(79,142,247,.1);border-radius:6px;padding:2px 4px;}\n.mm-group-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.mm-group-count{opacity:.6;font-size:11px;}\n.mm-group-del{border:none;background:transparent;color:inherit;cursor:pointer;opacity:.6;font-size:12px;padding:0 2px;}\n.mm-group-del:hover{opacity:1;}\n.mm-group-actions{display:flex;gap:4px;margin-top:5px;}\n.mm-gbtn{flex:1;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;border-radius:6px;padding:2px 4px;font-size:11px;cursor:pointer;}\n.mm-gbtn:hover:not(:disabled){background:rgba(127,127,127,.14);}\n.mm-gbtn:disabled{opacity:.35;cursor:default;}\n.mm-gbtn.pinned{background:rgba(79,142,247,.25);border-color:#4f8ef7;}\n.mm-modal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;background:#fff;color:#1f2328;border-radius:12px;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.35);min-width:260px;}\n@media (prefers-color-scheme:dark){.mm-modal{background:#2a2c33;color:#e8eaee;}}\n.mm-modal-title{font-size:14px;font-weight:600;margin-bottom:12px;}\n.mm-modal-actions{display:flex;gap:8px;flex-wrap:wrap;}\n.mm-hbtn{border:none;background:transparent;color:inherit;cursor:pointer;font-size:15px;padding:6px 8px;border-radius:8px;line-height:1;}\n.mm-hbtn:hover{background:rgba(127,127,127,.14);}\n.mm-act-card{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid rgba(127,127,127,.3);border-radius:10px;background:rgba(127,127,127,.08);}\n.mm-act-title{font-size:13px;font-weight:600;}\n.mm-act-sub{font-size:11px;opacity:.6;}\n.mm-act-btn{margin-left:auto;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;border-radius:6px;padding:4px 12px;font-size:12.5px;cursor:pointer;}\n.mm-act-btn:hover{background:rgba(127,127,127,.15);}\n`)

    function genId() {
      return 'n' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
    }
    function defaultGraph() {
      return { nodes: [{ id: 'root', title: '中心主题' }], edges: [], groups: [] }
    }
    function addNodeTo(g, id, title) {
      return { ...g, nodes: [...g.nodes, { id, title }] }
    }
    function removeNodeFrom(g, id) {
      return {
        ...g,
        nodes: g.nodes.filter((n) => n.id !== id),
        edges: g.edges.filter((e) => e.source !== id && e.target !== id),
        groups: (g.groups || []).map((gr) => ({
          ...gr,
          nodeIds: gr.nodeIds.filter((x) => x !== id),
        })).filter((gr) => gr.nodeIds.length > 0),
      }
    }
    function renameNodeIn(g, id, title) {
      return { ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, title } : n)) }
    }
    function setNodeTime(g, id, time) {
      return {
        ...g,
        nodes: g.nodes.map((n) => {
          if (n.id !== id) return n
          if (time === null) return { id: n.id, title: n.title }
          return { ...n, time }
        }),
      }
    }
    function reorderTimeline(g, orderedIds) {
      const timeById = {}
      orderedIds.forEach((id, i) => { timeById[id] = i * 10 })
      return {
        ...g,
        nodes: g.nodes.map((n) =>
          n.time !== undefined && timeById[n.id] !== undefined ? { ...n, time: timeById[n.id] } : n),
      }
    }
    function addEdgeIn(g, a, b) {
      if (a === b) return g
      const exists = g.edges.some((e) =>
        (e.source === a && e.target === b) || (e.source === b && e.target === a))
      if (exists) return g
      return { ...g, edges: [...g.edges, { source: a, target: b }] }
    }
    function renameEdgeIn(g, a, b, title) {
      return {
        ...g,
        edges: g.edges.map((e) =>
          ((e.source === a && e.target === b) || (e.source === b && e.target === a))
            ? { ...e, title }
            : e),
      }
    }
    function removeEdgeIn(g, a, b) {
      return {
        ...g,
        edges: g.edges.filter((e) =>
          !((e.source === a && e.target === b) || (e.source === b && e.target === a))),
      }
    }
    function disconnectNodeIn(g, id) {
      return { ...g, edges: g.edges.filter((e) => e.source !== id && e.target !== id) }
    }
    function createGroupIn(g, name, nodeIds) {
      return { ...g, groups: [...(g.groups || []), { id: genId(), name, nodeIds, pinned: false }] }
    }
    function removeGroupIn(g, id) {
      return { ...g, groups: (g.groups || []).filter((x) => x.id !== id) }
    }
    function setGroupPinned(g, id, pinned) {
      return { ...g, groups: (g.groups || []).map((x) => (x.id === id ? { ...x, pinned } : x)) }
    }
    function renameGroupIn(g, id, name) {
      return { ...g, groups: (g.groups || []).map((x) => (x.id === id ? { ...x, name } : x)) }
    }
    function graphStats(g) {
      const timed = g.nodes.filter((n) => n.time !== undefined).length
      return { nodes: g.nodes.length, edges: g.edges.length, timed }
    }
    function edgeKeyOf(a, b) {
      return a < b ? a + '|' + b : b + '|' + a
    }
    function nodeW(n) {
      return Math.max(64, Math.min(230, String(n.title || '').length * 14 + 40))
    }

    function connectedComponents(nodes, edges) {
      const adj = {}
      nodes.forEach((n) => { adj[n.id] = [] })
      edges.forEach((e) => {
        if (adj[e.source] && adj[e.target]) {
          adj[e.source].push(e.target)
          adj[e.target].push(e.source)
        }
      })
      const visited = new Set()
      const comps = []
      nodes.forEach((n) => {
        if (visited.has(n.id)) return
        const comp = []
        const stack = [n.id]
        visited.add(n.id)
        while (stack.length > 0) {
          const id = stack.pop()
          comp.push(id)
          ;(adj[id] || []).forEach((nb) => {
            if (!visited.has(nb)) {
              visited.add(nb)
              stack.push(nb)
            }
          })
        }
        comps.push(comp)
      })
      return comps
    }

    function findCycles(nodes, edges) {
      if (nodes.length > 30 || nodes.length === 0) return []
      const adj = {}
      nodes.forEach((n) => { adj[n.id] = [] })
      edges.forEach((e) => {
        if (adj[e.source] && adj[e.target]) {
          adj[e.source].push(e.target)
          adj[e.target].push(e.source)
        }
      })
      const cycles = []
      const seen = new Set()
      const MAX_LEN = 10
      const LIMIT = 20
      function dfs(start, cur, path) {
        if (cycles.length >= LIMIT) return
        for (const nb of adj[cur] || []) {
          if (nb === start && path.length >= 3) {
            const key = path.slice().sort().join(',')
            if (!seen.has(key)) {
              seen.add(key)
              cycles.push(path.slice())
            }
            continue
          }
          if (path.includes(nb) || nb < start) continue
          if (path.length >= MAX_LEN) continue
          dfs(start, nb, path.concat(nb))
        }
      }
      nodes.forEach((n) => { dfs(n.id, n.id, [n.id]) })
      return cycles
    }

    function resolveCollisions(nodes, pos, iterations) {
      const ids = nodes.map((n) => n.id)
      const half = {}
      nodes.forEach((n) => { half[n.id] = nodeW(n) / 2 })
      const work = {}
      ids.forEach((id) => { work[id] = { x: pos[id].x, y: pos[id].y } })
      for (let it = 0; it < iterations; it++) {
        let moved = false
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const a = ids[i]
            const b = ids[j]
            const pa = work[a]
            const pb = work[b]
            const minD = half[a] + half[b] + 10
            let dx = pb.x - pa.x
            let dy = pb.y - pa.y
            let d = Math.sqrt(dx * dx + dy * dy)
            if (d < minD && d > 0.001) {
              const push = (minD - d) / 2
              const ux = dx / d
              const uy = dy / d
              pa.x -= ux * push
              pa.y -= uy * push
              pb.x += ux * push
              pb.y += uy * push
              moved = true
            }
          }
        }
        if (!moved) break
      }
      ids.forEach((id) => { pos[id] = work[id] })
      return pos
    }

    function layoutBlock(block, edges, bx, ROW_Y) {
      const NODE_X = 190
      const pos = {}
      block.timed.forEach((n, i) => {
        pos[n.id] = { x: bx + 90 + i * NODE_X, y: ROW_Y }
      })
      const others = block.others
      const oPos = {}
      const vel = {}
      const timedIds = new Set(block.timed.map((n) => n.id))
      others.forEach((n, i) => {
        const col = i % 6
        const row = Math.floor(i / 6)
        oPos[n.id] = {
          x: bx + 130 + col * (NODE_X - 20) + (Math.random() - 0.5) * 30,
          y: ROW_Y + 170 + row * 150 + (Math.random() - 0.5) * 30,
        }
        vel[n.id] = { x: 0, y: 0 }
      })
      if (others.length > 0) {
        const allNodes = [...block.timed, ...block.others]
        const ids = new Set(allNodes.map((n) => n.id))
        const inEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target))
        const cycles = findCycles(allNodes, inEdges)
        const nodeCycles = new Map()
        cycles.forEach((cyc, ci) => {
          cyc.forEach((id) => {
            if (!nodeCycles.has(id)) nodeCycles.set(id, new Set())
            nodeCycles.get(id).add(ci)
          })
        })
        const centerX = bx + (Math.max(block.timed.length, 1) * NODE_X) / 2 + 90
        const centerY = ROW_Y + 260
        const REP = 2600
        const SPRING = 0.04
        const REST = 150
        const GRAV = 0.012
        const DAMP = 0.85
        const ITER = 220
        for (let it = 0; it < ITER; it++) {
          const centroids = cycles.map((cyc) => {
            let sx = 0
            let sy = 0
            let c = 0
            cyc.forEach((id) => {
              const q = oPos[id]
              if (q) { sx += q.x; sy += q.y; c++ }
            })
            return c > 0 ? { x: sx / c, y: sy / c } : null
          })
          for (const n of others) {
            const mem = nodeCycles.get(n.id)
            if (!mem) continue
            let cx = 0
            let cy = 0
            let c = 0
            mem.forEach((ci) => {
              const ctd = centroids[ci]
              if (ctd) { cx += ctd.x; cy += ctd.y; c++ }
            })
            if (c > 0) {
              vel[n.id].x += ((cx / c) - oPos[n.id].x) * 0.035
              vel[n.id].y += ((cy / c) - oPos[n.id].y) * 0.035
            }
          }
          for (let i = 0; i < others.length; i++) {
            for (let j = i + 1; j < others.length; j++) {
              const a = others[i].id
              const b = others[j].id
              let dx = oPos[a].x - oPos[b].x
              let dy = oPos[a].y - oPos[b].y
              let d2 = dx * dx + dy * dy
              if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = dx * dx + dy * dy }
              const d = Math.sqrt(d2)
              let rep = REP
              const ma = nodeCycles.get(a)
              const mb = nodeCycles.get(b)
              if (ma && mb) {
                let shared = false
                ma.forEach((ci) => { if (mb.has(ci)) shared = true })
                if (!shared) rep = REP * 1.9
              }
              const f = rep / (d2 + 1)
              const fx = (dx / d) * f
              const fy = (dy / d) * f
              vel[a].x += fx; vel[a].y += fy
              vel[b].x -= fx; vel[b].y -= fy
            }
            for (const t of block.timed) {
              const a = others[i].id
              let dx = oPos[a].x - pos[t.id].x
              let dy = oPos[a].y - pos[t.id].y
              let d2 = dx * dx + dy * dy
              if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = dx * dx + dy * dy }
              const d = Math.sqrt(d2)
              const f = REP / (d2 + 1)
              vel[a].x += (dx / d) * f
              vel[a].y += (dy / d) * f
            }
          }
          for (const e of inEdges) {
            const a = e.source
            const b = e.target
            const pa = oPos[a]
            const pb = oPos[b]
            if (!pa || !pb) continue
            let dx = pa.x - pb.x
            let dy = pa.y - pb.y
            let d = Math.sqrt(dx * dx + dy * dy)
            if (d < 0.01) d = 0.01
            const f = SPRING * (d - REST)
            const fx = (dx / d) * f
            const fy = (dy / d) * f
            if (timedIds.has(a)) { vel[b].x += fx; vel[b].y += fy }
            else if (timedIds.has(b)) { vel[a].x -= fx; vel[a].y -= fy }
            else { vel[a].x -= fx; vel[a].y -= fy; vel[b].x += fx; vel[b].y += fy }
          }
          for (const n of others) {
            vel[n.id].x += (centerX - oPos[n.id].x) * GRAV
            vel[n.id].y += (centerY - oPos[n.id].y) * GRAV
            vel[n.id].x *= DAMP
            vel[n.id].y *= DAMP
            oPos[n.id].x += vel[n.id].x
            oPos[n.id].y += vel[n.id].y
          }
        }
        others.forEach((n) => { pos[n.id] = oPos[n.id] })
      }
      const all = [...block.timed, ...block.others]
      resolveCollisions(all, pos, 60)
      const timedW = Math.max(1, block.timed.length - 1) * NODE_X + 200
      let othersW = 0
      if (others.length > 0) {
        let mn = Infinity
        let mx = -Infinity
        others.forEach((n) => { mn = Math.min(mn, pos[n.id].x); mx = Math.max(mx, pos[n.id].x) })
        othersW = mx - mn + 200
      }
      return { pos, width: Math.max(timedW, othersW) }
    }

    function blockLayout(nodes, edges) {
      const nodeMap = {}
      nodes.forEach((n) => { nodeMap[n.id] = n })
      const comps = connectedComponents(nodes, edges)
      const blocks = comps.map((ids) => {
        const all = ids.map((id) => nodeMap[id]).filter(Boolean)
        return {
          timed: all.filter((n) => n.time !== undefined).sort((a, b) => a.time - b.time),
          others: all.filter((n) => n.time === undefined),
        }
      })
      blocks.sort((a, b) => {
        const at = a.timed.length > 0 ? a.timed[0].time : Infinity
        const bt = b.timed.length > 0 ? b.timed[0].time : Infinity
        return at - bt
      })
      const pos = {}
      const BLOCK_GAP = 320
      const ROW_Y = 220
      let bx = 100
      blocks.forEach((block) => {
        const r = layoutBlock(block, edges, bx, ROW_Y)
        Object.assign(pos, r.pos)
        bx += r.width + BLOCK_GAP
      })
      return pos
    }

    function distToSegment(px, py, ax, ay, bx, by) {
      const dx = bx - ax
      const dy = by - ay
      const len2 = dx * dx + dy * dy
      if (len2 === 0) return Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay))
      let t = ((px - ax) * dx + (py - ay) * dy) / len2
      t = Math.max(0, Math.min(1, t))
      return Math.sqrt((px - (ax + t * dx)) * (px - (ax + t * dx)) + (py - (ay + t * dy)) * (py - (ay + t * dy)))
    }

    function escapeXml(s) {
      return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
    }

    function downloadBlob(blob, filename) {
      try {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
      } catch (err) {
        console.error('download failed', err)
      }
    }
    function buildSvg(graph, layout) {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">'
        + '<rect width="1400" height="900" fill="#ffffff"/>'
      graph.edges.forEach((e) => {
        const a = layout[e.source]
        const b = layout[e.target]
        if (a && b) {
          svg += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="#9aa3ad" stroke-width="2"/>'
          if (e.title) {
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            svg += '<rect x="' + (mx - 40) + '" y="' + (my - 10) + '" width="80" height="20" rx="8" fill="#14181e"/>'
              + '<text x="' + mx + '" y="' + (my + 4) + '" text-anchor="middle" fill="#fff" font-size="11">' + escapeXml(e.title) + '</text>'
          }
        }
      })
      graph.nodes.forEach((n) => {
        const pp = layout[n.id]
        if (!pp) return
        const w = nodeW(n)
        svg += '<rect x="' + (pp.x - w / 2) + '" y="' + (pp.y - 18) + '" width="' + w + '" height="36" rx="18" fill="' + PALETTE[hashId(n.id) % PALETTE.length] + '"/>'
          + '<text x="' + pp.x + '" y="' + (pp.y + 4) + '" text-anchor="middle" fill="#ffffff" font-size="13">' + escapeXml(n.title) + '</text>'
      })
      svg += '</svg>'
      return svg
    }

    function Toolbar(props) {
      const p = props || {}
      const btn = (label, onClick, disabled, title, active) =>
        React.createElement('button', {
          className: 'mm-tbtn' + (active ? ' active' : ''),
          onClick,
          disabled: !!disabled,
          title,
        }, label)
      const selIsNode = p.selKind === 'node'
      const selIsEdge = p.selKind === 'edge'
      const multiCount = p.multiCount
      return React.createElement('div', { className: 'mm-toolbar' },
        btn('＋节点', p.onAddNode, p.readOnly, '添加网络节点(双击画布空白也可)'),
        btn('＋时间轴', p.onAddTimeline, p.readOnly, '在时间轴末尾添加节点'),
        btn('连线', p.onToggleLink, p.readOnly, '点击两个节点建立连接', p.linkMode),
        React.createElement('span', { className: 'mm-sep' }),
        btn('重命名', p.onRename, p.readOnly || (!selIsNode && !selIsEdge), '重命名选中节点/连线'),
        btn('断开', p.onDisconnect, p.readOnly || (!selIsNode && multiCount === 0), '断开选中节点的连接'),
        btn('删除', p.onRemove, p.readOnly || (!selIsNode && !selIsEdge && multiCount === 0), '删除选中节点或连线'),
        React.createElement('span', { className: 'mm-sep' }),
        btn('入轴', p.onAddToTimeline, p.readOnly || !selIsNode || p.selTimed, '把选中节点加入时间轴'),
        btn('出轴', p.onRemoveFromTimeline, p.readOnly || !selIsNode || !p.selTimed, '把选中节点移出时间轴'),
        React.createElement('span', { className: 'mm-sep' }),
        btn('复位布局', p.onRelayout, p.readOnly, '按连通块 + 时间轴顺序重新排布'),
        btn('复位视图', p.onReset, p.readOnly, '居中选中或适配全部'),
        React.createElement('span', { className: 'mm-sep' }),
        btn('保存', p.onSave, false, '保存到本地'),
        btn('导出', p.onExport, false, '导出数据或图像'),
        btn('导入', p.onImport, false, '导入数据文件'),
        React.createElement('span', { className: 'mm-sep' }),
        btn('＋', p.onZoomIn, false, '放大'),
        btn('−', p.onZoomOut, false, '缩小'),
        React.createElement('span', { className: 'mm-stats' },
          String(p.stats.nodes) + ' 节点 · ' + String(p.stats.edges) + ' 连接 · ' + String(p.stats.timed) + ' 在轴'
          + (multiCount > 1 ? ' · 已选 ' + multiCount : '')),
      )
    }

    function GroupsPanel(props) {
      const groups = props.groups || []
      const onSelect = props.onSelect
      const onFocus = props.onFocus
      const onRemove = props.onRemove
      const onPin = props.onPin
      const onRename = props.onRename
      return React.createElement('div', { className: 'mm-groups' },
        React.createElement('div', { className: 'mm-groups-title' }, '网络团'),
        groups.length === 0
          ? React.createElement('div', { style: { fontSize: 11, opacity: .55, padding: 4 } },
              '选中多个节点后右键「命名网络团」')
          : groups.map((gr) =>
              React.createElement('div', { key: gr.id, className: 'mm-group-card' },
                React.createElement('div', {
                  className: 'mm-group-head',
                  onClick: () => onSelect(gr.nodeIds),
                  onDoubleClick: () => onFocus(gr.nodeIds),
                },
                  React.createElement('span', { className: 'mm-group-name' }, gr.name),
                  React.createElement('span', { className: 'mm-group-count' }, gr.nodeIds.length),
                  React.createElement('button', {
                    className: 'mm-group-del',
                    title: '删除网络团',
                    onClick: (e) => { e.stopPropagation(); onRemove(gr.id) },
                  }, '×'),
                ),
                React.createElement('div', { className: 'mm-group-actions' },
                  React.createElement('button', {
                    className: 'mm-gbtn' + (gr.pinned ? ' pinned' : ''),
                    disabled: !!gr.pinned,
                    title: gr.pinned ? '已固定' : '固定为整体',
                    onClick: () => onPin(gr.id, true),
                  }, '固定'),
                  React.createElement('button', {
                    className: 'mm-gbtn' + (!gr.pinned ? ' pinned' : ''),
                    disabled: !gr.pinned,
                    title: !gr.pinned ? '已松开' : '松开以编辑单个节点',
                    onClick: () => onPin(gr.id, false),
                  }, '松开'),
                  React.createElement('button', {
                    className: 'mm-gbtn',
                    title: '重命名网络团',
                    onClick: () => onRename(gr.id, gr.name),
                  }, '重命名'),
                ),
              )),
      )
    }

    function DocsPanel(props) {
      const docs = props.docs || []
      const currentId = props.currentId
      const onSelect = props.onSelect
      const onCreate = props.onCreate
      const onDelete = props.onDelete
      const onRename = props.onRename
      const onDuplicate = props.onDuplicate
      return React.createElement('div', { className: 'mm-docs' },
        React.createElement('div', { className: 'mm-docs-title' }, '图像'),
        docs.map((d) =>
          React.createElement('div', {
            key: d.id,
            className: 'mm-doc-card' + (d.id === currentId ? ' active' : ''),
            onClick: () => onSelect(d.id),
          },
            React.createElement('span', { className: 'mm-doc-name' }, d.name),
            React.createElement('button', {
              className: 'mm-doc-btn', title: '复制图像',
              onClick: (e) => { e.stopPropagation(); onDuplicate(d.id) },
            }, '⧉'),
            React.createElement('button', {
              className: 'mm-doc-btn', title: '重命名图像',
              onClick: (e) => { e.stopPropagation(); onRename(d.id, d.name) },
            }, '✎'),
            React.createElement('button', {
              className: 'mm-doc-btn', title: '删除图像',
              onClick: (e) => { e.stopPropagation(); onDelete(d.id) },
            }, '×'),
          )),
        React.createElement('div', { className: 'mm-doc-actions' },
          React.createElement('button', { className: 'mm-dact', onClick: onCreate }, '＋ 新建'),
        ),
      )
    }

    function MindmapEditor(props) {
      const graph = props.graph
      const onChange = props.onChange
      const onLayoutChange = props.onLayoutChange
      const readOnly = !!props.readOnly
      const [positions, setPositions] = React.useState(null)
      const [selected, setSelected] = React.useState(null)
      const [multi, setMulti] = React.useState(new Set())
      const [linkMode, setLinkMode] = React.useState(false)
      const [linkFrom, setLinkFrom] = React.useState(null)
      const [editing, setEditing] = React.useState(null)
      const [draft, setDraft] = React.useState('')
      const [view, setView] = React.useState({ x: 40, y: 24, scale: 1 })
      const [drag, setDrag] = React.useState(null)
      const [dragSel, setDragSel] = React.useState(null)
      const [tlDrag, setTlDrag] = React.useState(null)
      const [ctxMenu, setCtxMenu] = React.useState(null)
      const [naming, setNaming] = React.useState(false)
      const [groupName, setGroupName] = React.useState('')
      const [renamingGroup, setRenamingGroup] = React.useState(null)
      const stats = graphStats(graph)

      React.useEffect(() => {
        setPositions(props.initialLayout ? props.initialLayout : blockLayout(graph.nodes, graph.edges))
      }, [])

      React.useEffect(() => {
        if (positions && onLayoutChange) onLayoutChange(positions)
      }, [positions])

      const commit = (next) => { if (onChange) onChange(next) }
      const nodeById = (id) => graph.nodes.find((n) => n.id === id)
      const timelineNodes = graph.nodes.filter((n) => n.time !== undefined)
        .sort((a, b) => a.time - b.time)
      const TL_SPACING = 110
      const tlX = (index) => 28 + index * TL_SPACING
      const maxTime = graph.nodes.reduce((m, n) => (n.time !== undefined && n.time > m ? n.time : m), 0)
      const canvasRectRef = {}
      const pinnedGroupOf = (id) => (graph.groups || []).find((g) => g.pinned && g.nodeIds.includes(id))

      const startEdit = (target, text) => {
        if (readOnly) return
        setEditing(target)
        setDraft(text)
      }
      const submitEdit = () => {
        const t = editing
        const text = draft.trim()
        setEditing(null)
        if (t === null || !text) return
        if (t.kind === 'edge') {
          commit(renameEdgeIn(graph, t.a, t.b, text))
        } else {
          commit(renameNodeIn(graph, t.id, text))
        }
      }
      const cancelEdit = () => setEditing(null)
      const stopInput = (e) => e.stopPropagation()

      const setPos = (updater) => {
        setPositions((p) => (typeof updater === 'function' ? updater(p) : updater))
      }

      const overlapsAny = (x, y, selfId, half) => {
        for (const n of graph.nodes) {
          if (n.id === selfId) continue
          const pp = positions && positions[n.id]
          if (!pp) continue
          const minD = half + nodeW(n) / 2 + 10
          const dx = pp.x - x
          const dy = pp.y - y
          if (dx * dx + dy * dy < minD * minD) return true
        }
        return false
      }
      const findFreeSpot = (x, y, selfId, half) => {
        if (!overlapsAny(x, y, selfId, half)) return { x, y }
        for (let r = 30; r < 400; r += 28) {
          for (let a = 0; a < 12; a++) {
            const angle = (a / 12) * Math.PI * 2
            const cx = x + Math.cos(angle) * r
            const cy = y + Math.sin(angle) * r
            if (!overlapsAny(cx, cy, selfId, half)) return { x: cx, y: cy }
          }
        }
        return { x: x + 60, y: y + 60 }
      }

      const addNode = (x, y, timed) => {
        if (readOnly) return
        const id = genId()
        const spot = findFreeSpot(x, y, id, 60)
        let g = addNodeTo(graph, id, '新节点')
        if (timed) g = setNodeTime(g, id, maxTime + 10)
        commit(g)
        setPos((p) => ({ ...p, [id]: spot }))
        setSelected({ kind: 'node', id })
        setMulti(new Set([id]))
        startEdit({ id, where: 'network' }, '新节点')
      }
      const addNodeCenter = () => {
        addNode(450 + (Math.random() - 0.5) * 120, 280 + (Math.random() - 0.5) * 120, false)
      }
      const addTimelineNode = () => {
        if (readOnly) return
        const id = genId()
        const spot = findFreeSpot(450, 280, id, 60)
        let g = addNodeTo(graph, id, '新节点')
        g = setNodeTime(g, id, maxTime + 10)
        commit(g)
        setPos((p) => ({ ...p, [id]: spot }))
        setSelected({ kind: 'node', id })
        setMulti(new Set([id]))
        startEdit({ id, where: 'timeline' }, '新节点')
      }
      const addLinkedNode = (id) => {
        if (readOnly) return
        const base = positions && positions[id] ? positions[id] : { x: 400, y: 300 }
        const newId = genId()
        const spot = findFreeSpot(base.x + 90, base.y + 50, newId, 60)
        let g = addNodeTo(graph, newId, '新节点')
        g = addEdgeIn(g, id, newId)
        commit(g)
        setPos((p) => ({ ...p, [newId]: spot }))
        setSelected({ kind: 'node', id: newId })
        setMulti(new Set([newId]))
        startEdit({ id: newId, where: 'network' }, '新节点')
      }
      const removeById = (id) => {
        commit(removeNodeFrom(graph, id))
        setPos((p) => {
          const next = { ...p }
          delete next[id]
          return next
        })
        setMulti((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        if (selected && selected.kind === 'node' && selected.id === id) setSelected(null)
        setLinkFrom(null)
        setEditing(null)
      }
      const removeMulti = () => {
        const ids = Array.from(multi)
        if (ids.length === 0) return
        let g = graph
        ids.forEach((id) => { g = removeNodeFrom(g, id) })
        commit(g)
        setPos((p) => {
          const next = { ...p }
          ids.forEach((id) => delete next[id])
          return next
        })
        setMulti(new Set())
        setSelected(null)
        setCtxMenu(null)
        setEditing(null)
      }
      const renameById = (id) => {
        const node = nodeById(id)
        if (node) startEdit({ id, where: 'network' }, node.title)
      }
      const addToTimelineById = (id) => {
        const node = nodeById(id)
        if (!node || node.time !== undefined) return
        commit(setNodeTime(graph, node.id, maxTime + 10))
      }
      const removeFromTimelineById = (id) => {
        const node = nodeById(id)
        if (!node || node.time === undefined) return
        commit(setNodeTime(graph, node.id, null))
      }
      const disconnectById = (id) => {
        commit(disconnectNodeIn(graph, id))
      }
      const disconnectMulti = () => {
        const idSet = new Set(multi)
        if (idSet.size === 0) return
        const kept = graph.edges.filter((e) => !(idSet.has(e.source) && idSet.has(e.target)))
        commit({ ...graph, edges: kept })
        setCtxMenu(null)
      }
      const duplicateMulti = () => {
        const ids = Array.from(multi)
        if (ids.length === 0) return
        const idMap = {}
        const newPos = {}
        let g = graph
        ids.forEach((id) => {
          const n = nodeById(id)
          if (!n) return
          const nid = genId()
          idMap[id] = nid
          g = addNodeTo(g, nid, n.title)
          if (n.time !== undefined) g = setNodeTime(g, nid, maxTime + 10)
          const base = positions && positions[id] ? positions[id] : { x: 400, y: 300 }
          newPos[nid] = findFreeSpot(base.x + 30, base.y + 30, nid, nodeW(n) / 2)
        })
        ids.forEach((a) => {
          ids.forEach((b) => {
            if (a >= b) return
            const orig = graph.edges.find((e) =>
              (e.source === a && e.target === b) || (e.source === b && e.target === a))
            if (!orig) return
            g = addEdgeIn(g, idMap[a], idMap[b])
            if (orig.title) {
              g = {
                ...g,
                edges: g.edges.map((edge) =>
                  ((edge.source === idMap[a] && edge.target === idMap[b]) || (edge.source === idMap[b] && edge.target === idMap[a]))
                    ? { ...edge, title: orig.title }
                    : edge),
              }
            }
          })
        })
        commit(g)
        setPos((p) => ({ ...p, ...newPos }))
        setMulti(new Set(ids.map((id) => idMap[id])))
        setCtxMenu(null)
      }
      const confirmGroup = () => {
        const name = groupName.trim() || '网络团'
        const ids = Array.from(multi)
        if (ids.length === 0) { setNaming(false); return }
        commit(createGroupIn(graph, name, ids))
        setNaming(false)
        setGroupName('')
        setCtxMenu(null)
      }
      const confirmRenameGroup = () => {
        const name = groupName.trim()
        if (renamingGroup && name) commit(renameGroupIn(graph, renamingGroup.id, name))
        setRenamingGroup(null)
        setGroupName('')
      }
      const removeSelected = () => {
        if (selected === null) {
          if (multi.size > 0) removeMulti()
          return
        }
        if (selected.kind === 'edge') {
          const parts = selected.key.split('|')
          commit(removeEdgeIn(graph, parts[0], parts[1]))
          setSelected(null)
          setEditing(null)
          return
        }
        removeById(selected.id)
      }
      const renameSelected = () => {
        if (selected === null) return
        if (selected.kind === 'edge') {
          const parts = selected.key.split('|')
          const e = graph.edges.find((x) =>
            (x.source === parts[0] && x.target === parts[1]) || (x.source === parts[1] && x.target === parts[0]))
          startEdit({ kind: 'edge', a: parts[0], b: parts[1] }, e && e.title ? e.title : '')
          return
        }
        renameById(selected.id)
      }
      const disconnectSelected = () => {
        if (selected === null || selected.kind !== 'node') return
        disconnectById(selected.id)
      }
      const addToTimeline = () => {
        if (selected === null || selected.kind !== 'node') return
        addToTimelineById(selected.id)
      }
      const removeFromTimeline = () => {
        if (selected === null || selected.kind !== 'node') return
        removeFromTimelineById(selected.id)
      }
      const toggleLinkMode = () => {
        if (readOnly) return
        setLinkMode(!linkMode)
        setLinkFrom(null)
        setCtxMenu(null)
      }
      const onNodeClick = (e, id) => {
        if (linkMode) {
          if (linkFrom === null) {
            setLinkFrom(id)
          } else if (linkFrom === id) {
            setLinkFrom(null)
          } else {
            commit(addEdgeIn(graph, linkFrom, id))
            setLinkFrom(null)
            setLinkMode(false)
          }
          setCtxMenu(null)
          return
        }
        if (e && e.ctrlKey) {
          setMulti((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
          setSelected({ kind: 'node', id })
          setCtxMenu(null)
          return
        }
        setMulti(new Set([id]))
        setSelected({ kind: 'node', id })
        setCtxMenu(null)
      }
      const relayout = () => {
        if (readOnly) return
        let newPos = blockLayout(graph.nodes, graph.edges)
        const pinnedGroups = (graph.groups || []).filter((g) => g.pinned)
        if (pinnedGroups.length > 0 && positions) {
          pinnedGroups.forEach((g) => {
            const members = g.nodeIds.filter((id) => positions[id] && newPos[id])
            if (members.length < 2) return
            let ox = 0
            let oy = 0
            members.forEach((id) => { ox += positions[id].x; oy += positions[id].y })
            const oc = { x: ox / members.length, y: oy / members.length }
            const rel = members.map((id) => ({ id, dx: positions[id].x - oc.x, dy: positions[id].y - oc.y }))
            let nx = 0
            let ny = 0
            members.forEach((id) => { nx += newPos[id].x; ny += newPos[id].y })
            const nc = { x: nx / members.length, y: ny / members.length }
            rel.forEach((r) => { newPos[r.id] = { x: nc.x + r.dx, y: nc.y + r.dy } })
          })
          newPos = resolveCollisions(graph.nodes, newPos, 40)
        }
        setPos(newPos)
        setCtxMenu(null)
      }
      const zoom = (f) => setView((v) => ({ ...v, scale: Math.max(0.2, Math.min(3, v.scale * f)) }))

      const fitNodes = (ids) => {
        const pts = ids.map((id) => p[id]).filter(Boolean)
        if (pts.length === 0) return
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        pts.forEach((pt) => {
          minX = Math.min(minX, pt.x)
          minY = Math.min(minY, pt.y)
          maxX = Math.max(maxX, pt.x)
          maxY = Math.max(maxY, pt.y)
        })
        const cw = canvasRectRef.w || 900
        const ch = canvasRectRef.h || 540
        const pad = 60
        const bw = Math.max(160, maxX - minX + 160)
        const bh = Math.max(120, maxY - minY + 120)
        const ns = Math.max(0.15, Math.min(3, Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh)))
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        setView({ scale: ns, x: cw / 2 - cx * ns, y: ch / 2 - cy * ns })
      }
      const resetView = () => {
        if (multi.size > 0) {
          fitNodes(Array.from(multi))
        } else if (selected && selected.kind === 'node') {
          fitNodes([selected.id])
        } else if (selected && selected.kind === 'edge') {
          fitNodes(selected.key.split('|'))
        } else {
          fitNodes(graph.nodes.map((n) => n.id))
        }
      }

      const focusNode = (id) => {
        const pos = positions && positions[id]
        if (!pos) return
        setSelected({ kind: 'node', id })
        setMulti(new Set([id]))
        const cw = canvasRectRef.w || 900
        const ch = canvasRectRef.h || 540
        setView((v) => ({
          x: cw / 2 - pos.x * v.scale,
          y: ch / 2 - pos.y * v.scale,
          scale: v.scale,
        }))
      }

      const onBgPointerDown = (e) => {
        if (readOnly) return
        setCtxMenu(null)
        setSelected(null)
        const rect = e.currentTarget.getBoundingClientRect()
        canvasRectRef.w = rect.width
        canvasRectRef.h = rect.height
        const x = (e.clientX - rect.left - view.x) / view.scale
        const y = (e.clientY - rect.top - view.y) / view.scale
        if (e.ctrlKey) {
          setDragSel({ x1: x, y1: y, x2: x, y2: y })
          setDrag(null)
          return
        }
        setDrag({ type: 'bg', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y })
        setMulti(new Set())
      }
      const onNodePointerDown = (e, id) => {
        e.stopPropagation()
        if (readOnly) return
        setCtxMenu(null)
        setSelected({ kind: 'node', id })
        const pg = pinnedGroupOf(id)
        if (pg) {
          setMulti(new Set(pg.nodeIds))
          const starts = {}
          pg.nodeIds.forEach((mid) => {
            const cur = positions && positions[mid] ? positions[mid] : { x: 0, y: 0 }
            starts[mid] = { x: cur.x, y: cur.y }
          })
          setDrag({ type: 'batch', sx: e.clientX, sy: e.clientY, starts })
          return
        }
        if (multi.has(id) && multi.size > 1) {
          const starts = {}
          multi.forEach((mid) => {
            const cur = positions && positions[mid] ? positions[mid] : { x: 0, y: 0 }
            starts[mid] = { x: cur.x, y: cur.y }
          })
          setDrag({ type: 'batch', sx: e.clientX, sy: e.clientY, starts })
        } else {
          const cur = positions && positions[id] ? positions[id] : { x: 0, y: 0 }
          setDrag({ type: 'node', id, sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y })
        }
      }
      const onPointerMove = (e) => {
        if (dragSel) {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left - view.x) / view.scale
          const y = (e.clientY - rect.top - view.y) / view.scale
          setDragSel((d) => ({ ...d, x2: x, y2: y }))
          return
        }
        if (!drag) return
        if (drag.type === 'batch') {
          const dx = (e.clientX - drag.sx) / view.scale
          const dy = (e.clientY - drag.sy) / view.scale
          setPos((p) => {
            const next = { ...p }
            Object.keys(drag.starts).forEach((mid) => {
              next[mid] = { x: drag.starts[mid].x + dx, y: drag.starts[mid].y + dy }
            })
            return next
          })
        } else if (drag.type === 'node') {
          const dx = (e.clientX - drag.sx) / view.scale
          const dy = (e.clientY - drag.sy) / view.scale
          const nx = drag.ox + dx
          const ny = drag.oy + dy
          const self = nodeById(drag.id)
          const half = self ? nodeW(self) / 2 : 30
          if (!overlapsAny(nx, ny, drag.id, half)) {
            setPos((p) => ({ ...p, [drag.id]: { x: nx, y: ny } }))
          }
        } else {
          setView((v) => ({
            x: drag.ox + (e.clientX - drag.sx),
            y: drag.oy + (e.clientY - drag.sy),
            scale: v.scale,
          }))
        }
      }
      const endDrag = () => {
        if (dragSel) {
          const d = dragSel
          const x1 = Math.min(d.x1, d.x2)
          const x2 = Math.max(d.x1, d.x2)
          const y1 = Math.min(d.y1, d.y2)
          const y2 = Math.max(d.y1, d.y2)
          setMulti((prev) => {
            const next = new Set(prev)
            for (const n of graph.nodes) {
              const pp = positions && positions[n.id]
              if (!pp) continue
              if (pp.x >= x1 && pp.x <= x2 && pp.y >= y1 && pp.y <= y2) next.add(n.id)
            }
            return next
          })
          setDragSel(null)
          return
        }
        setDrag(null)
      }
      const onWheel = (e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        canvasRectRef.w = rect.width
        canvasRectRef.h = rect.height
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        setView((v) => {
          const ns = Math.max(0.2, Math.min(3, v.scale * f))
          const k = ns / v.scale
          return {
            scale: ns,
            x: mx - (mx - v.x) * k,
            y: my - (my - v.y) * k,
          }
        })
      }
      const onBgDoubleClick = (e) => {
        if (readOnly) return
        const rect = e.currentTarget.getBoundingClientRect()
        canvasRectRef.w = rect.width
        canvasRectRef.h = rect.height
        const x = (e.clientX - rect.left - view.x) / view.scale
        const y = (e.clientY - rect.top - view.y) / view.scale
        addNode(x, y, false)
      }
      const onCanvasContextMenu = (e) => {
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        canvasRectRef.w = rect.width
        canvasRectRef.h = rect.height
        const w = rect.width
        const h = rect.height
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const cx = (sx - view.x) / view.scale
        const cy = (sy - view.y) / view.scale
        let hitNode = null
        for (const n of graph.nodes) {
          const pp = positions && positions[n.id]
          if (!pp) continue
          const hw = nodeW(n) / 2 + 8
          if (Math.abs(pp.x - cx) <= hw && Math.abs(pp.y - cy) <= 26) {
            hitNode = n.id
            break
          }
        }
        if (hitNode !== null) {
          if (!multi.has(hitNode)) setMulti(new Set([hitNode]))
          setSelected({ kind: 'node', id: hitNode })
          setCtxMenu({
            x: sx, y: sy, w, h,
            kind: multi.has(hitNode) && multi.size > 1 ? 'multi' : 'node',
            id: hitNode,
          })
          return
        }
        for (const e2 of graph.edges) {
          const a = positions && positions[e2.source]
          const b = positions && positions[e2.target]
          if (!a || !b) continue
          if (distToSegment(cx, cy, a.x, a.y, b.x, b.y) < 10) {
            const key = edgeKeyOf(e2.source, e2.target)
            setSelected({ kind: 'edge', key })
            setCtxMenu({ x: sx, y: sy, w, h, kind: 'edge', key })
            return
          }
        }
        setCtxMenu(null)
      }
      const runCtx = (fn) => {
        setCtxMenu(null)
        fn()
      }
      const onTlDoubleClick = (e) => {
        if (readOnly) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const idx = Math.max(0, Math.round((x - 28) / TL_SPACING))
        const id = genId()
        const spot = findFreeSpot(450, 280, id, 60)
        let g = addNodeTo(graph, id, '新节点')
        const ids = timelineNodes.map((n) => n.id)
        const pos = Math.min(ids.length, idx)
        ids.splice(pos, 0, id)
        g = reorderTimeline(g, ids)
        commit(g)
        setPos((p) => ({ ...p, [id]: spot }))
        setSelected({ kind: 'node', id })
        setMulti(new Set([id]))
        startEdit({ id, where: 'timeline' }, '新节点')
      }
      const onTlPointerDown = (e, id) => {
        e.stopPropagation()
        if (readOnly) return
        setTlDrag(id)
        setSelected({ kind: 'node', id })
        setMulti(new Set([id]))
      }
      const onTlPointerMove = (e) => {
        if (tlDrag === null) return
        const track = e.currentTarget
        const rect = track.getBoundingClientRect()
        const x = e.clientX - rect.left
        const idx = Math.max(0, Math.round((x - 28) / TL_SPACING))
        const ids = timelineNodes.map((n) => n.id)
        const from = ids.indexOf(tlDrag)
        if (from === -1) return
        const target = Math.max(0, Math.min(ids.length - 1, idx))
        if (target !== from) {
          ids.splice(from, 1)
          ids.splice(target, 0, tlDrag)
          commit(reorderTimeline(graph, ids))
        }
      }
      const onTlPointerUp = () => setTlDrag(null)

      const p = positions || {}
      const selTimed = selected && selected.kind === 'node' && nodeById(selected.id) && nodeById(selected.id).time !== undefined

      const edgeLines = []
      const edgeOverlays = []
      const labelSpots = []
      graph.edges.forEach((e, i) => {
        const a = p[e.source]
        const b = p[e.target]
        if (!a || !b) return
        const key = edgeKeyOf(e.source, e.target)
        const linking = linkMode && (linkFrom === e.source || linkFrom === e.target)
        const isSel = selected && selected.kind === 'edge' && selected.key === key
        const isEditingEdge = editing && editing.kind === 'edge' && edgeKeyOf(editing.a, editing.b) === key
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        edgeLines.push(
          React.createElement('line', {
            key: 'e' + i,
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            className: 'mm-edge' + (linking ? ' link' : '') + (isSel ? ' selected' : ''),
          }),
        )
        edgeLines.push(
          React.createElement('line', {
            key: 'eh' + i,
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            className: 'mm-edge-hit',
            onClick: () => setSelected({ kind: 'edge', key }),
            onDoubleClick: () => startEdit({ kind: 'edge', a: e.source, b: e.target }, e.title ? e.title : ''),
          }),
        )
        if (isEditingEdge) {
          edgeOverlays.push(
            React.createElement('input', {
              key: 'ee' + i,
              className: 'mm-elabel-input',
              style: { left: mx, top: my },
              autoFocus: true,
              value: draft,
              onPointerDown: stopInput,
              onChange: (ev) => setDraft(ev.target.value),
              onKeyDown: (ev) => {
                if (ev.key === 'Enter') submitEdit()
                else if (ev.key === 'Escape') cancelEdit()
              },
              onBlur: submitEdit,
            }),
          )
        } else if (e.title) {
          labelSpots.push({ key, e, mx, my, isSel })
        }
      })
      const placedLabels = []
      const labelFinal = labelSpots.map((spot) => {
        let baseOffset = 0
        for (const other of placedLabels) {
          const dx = spot.mx - other.mx
          const dy = spot.my - other.my
          if (Math.sqrt(dx * dx + dy * dy) < 96) baseOffset += 18
        }
        placedLabels.push(spot)
        const labelW = String(spot.e.title || '').length * 6 + 22
        const tries = [baseOffset, baseOffset + 22, baseOffset - 22, baseOffset + 44, baseOffset - 44]
        let chosen = baseOffset
        for (const dy of tries) {
          let blocked = false
          for (const n of graph.nodes) {
            const pp = p[n.id]
            if (!pp) continue
            const dx = Math.abs(spot.mx - pp.x)
            const dy2 = Math.abs((spot.my + dy) - pp.y)
            if (dx < labelW / 2 + nodeW(n) / 2 + 4 && dy2 < 18 + 20) {
              blocked = true
              break
            }
          }
          if (!blocked) { chosen = dy; break }
        }
        return { ...spot, offset: chosen }
      })
      labelFinal.forEach((spot) => {
        edgeOverlays.push(
          React.createElement('div', {
            key: 'el' + spot.key,
            className: 'mm-elabel' + (spot.isSel ? ' selected' : ''),
            style: { left: spot.mx, top: spot.my + spot.offset },
            onClick: () => setSelected({ kind: 'edge', key: spot.key }),
            onDoubleClick: () => startEdit({ kind: 'edge', a: spot.e.source, b: spot.e.target }, spot.e.title),
          }, spot.e.title),
        )
      })

      const showFog = view.scale < 0.45 && graph.nodes.length > 0
      const fogEls = []
      if (showFog) {
        const comps = connectedComponents(graph.nodes, graph.edges)
        comps.forEach((ids, idx) => {
          const members = ids.filter((id) => p[id])
          if (members.length === 0) return
          let cx = 0
          let cy = 0
          members.forEach((id) => { cx += p[id].x; cy += p[id].y })
          cx /= members.length
          cy /= members.length
          let name = null
          const timed = graph.nodes.filter((n) => members.includes(n.id) && n.time !== undefined)
            .sort((a, b) => a.time - b.time)
          if (timed.length > 0) name = timed[0].title
          if (!name) {
            const gr = (graph.groups || []).find((g) => g.nodeIds.some((id) => members.includes(id)))
            if (gr) name = gr.name
          }
          if (!name) name = '雾团' + (idx + 1)
          fogEls.push(
            React.createElement('div', {
              key: 'fog' + idx,
              className: 'mm-fog',
              style: { left: cx * view.scale + view.x, top: cy * view.scale + view.y },
              onClick: () => fitNodes(members),
            }, name),
          )
        })
      }

      const nodeEls = showFog ? [] : graph.nodes.map((n) => {
        const pos = p[n.id] || { x: 0, y: 0 }
        const width = nodeW(n)
        const height = 36
        const isSel = multi.has(n.id)
        if (editing && editing.kind !== 'edge' && editing.id === n.id && editing.where === 'network') {
          return React.createElement('div', {
            key: n.id,
            className: 'mm-node mm-editing',
            style: { left: pos.x - width / 2, top: pos.y - height / 2, width: width + 16, height },
          },
            React.createElement('input', {
              className: 'mm-node-input',
              autoFocus: true,
              value: draft,
              onPointerDown: stopInput,
              onChange: (e) => setDraft(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') submitEdit()
                else if (e.key === 'Escape') cancelEdit()
              },
              onBlur: submitEdit,
            }),
          )
        }
        return React.createElement('div', {
          key: n.id,
          className: 'mm-node'
            + (isSel ? ' selected' : '')
            + (linkMode && linkFrom === n.id ? ' linking' : '')
            + (n.time !== undefined ? ' timed' : ''),
          style: {
            left: pos.x - width / 2,
            top: pos.y - height / 2,
            width,
            height,
            background: PALETTE[hashId(n.id) % PALETTE.length],
          },
          onClick: (e) => onNodeClick(e, n.id),
          onDoubleClick: () => startEdit({ id: n.id, where: 'network' }, n.title),
          onPointerDown: (e) => onNodePointerDown(e, n.id),
        }, n.title)
      })

      const tlEls = timelineNodes.map((n, i) => {
        const x = tlX(i)
        const isSel = multi.has(n.id)
        if (editing && editing.kind !== 'edge' && editing.id === n.id && editing.where === 'timeline') {
          return React.createElement('input', {
            key: 'tli' + n.id,
            className: 'mm-tl-input',
            style: { left: x },
            autoFocus: true,
            value: draft,
            onPointerDown: stopInput,
            onChange: (e) => setDraft(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') submitEdit()
              else if (e.key === 'Escape') cancelEdit()
            },
            onBlur: submitEdit,
          })
        }
        return React.createElement(React.Fragment, { key: 'tln' + n.id },
          React.createElement('div', {
            className: 'mm-tl-node' + (isSel ? ' selected' : ''),
            style: { left: x, background: PALETTE[hashId(n.id) % PALETTE.length] },
            onClick: (e) => { e.stopPropagation(); onNodeClick(e, n.id) },
            onDoubleClick: (e) => { e.stopPropagation(); focusNode(n.id) },
            onPointerDown: (e) => onTlPointerDown(e, n.id),
          }, String(n.title || '').slice(0, 3)),
          React.createElement('span', {
            className: 'mm-tl-label',
            style: { left: x },
          }, n.title),
        )
      })

      let ctxItems = []
      if (ctxMenu) {
        if (ctxMenu.kind === 'edge') {
          const parts = ctxMenu.key.split('|')
          ctxItems = [
            { label: '✎ 重命名', run: () => { const ed = graph.edges.find((x) => edgeKeyOf(x.source, x.target) === ctxMenu.key); startEdit({ kind: 'edge', a: parts[0], b: parts[1] }, ed && ed.title ? ed.title : '') }, disabled: false },
            { label: '✕ 删除', run: () => { commit(removeEdgeIn(graph, parts[0], parts[1])); setSelected(null) }, disabled: false },
            { label: '＋ 加节点', run: null, disabled: true },
            { label: '✏ 连线', run: null, disabled: true },
            { label: '⤵ 入轴', run: null, disabled: true },
            { label: '⤴ 出轴', run: null, disabled: true },
          ]
        } else if (ctxMenu.kind === 'multi') {
          ctxItems = [
            { label: '✕ 删除', run: () => removeMulti(), disabled: false },
            { label: '⧉ 复制', run: () => duplicateMulti(), disabled: false },
            { label: '▦ 命名网络团', run: () => { setNaming(true); setGroupName('') }, disabled: false },
            { label: '⌁ 断开', run: () => disconnectMulti(), disabled: false },
          ]
        } else {
          const id = ctxMenu.id
          const node = nodeById(id)
          const timed = node ? node.time !== undefined : false
          ctxItems = [
            { label: '＋ 加节点', run: () => addLinkedNode(id), disabled: false },
            { label: '✏ 连线', run: () => { setLinkMode(true); setLinkFrom(id); setSelected({ kind: 'node', id }) }, disabled: false },
            { label: '✎ 重命名', run: () => renameById(id), disabled: false },
            { label: '✕ 删除', run: () => removeById(id), disabled: false },
            { label: '⤵ 入轴', run: () => addToTimelineById(id), disabled: timed },
            { label: '⤴ 出轴', run: () => removeFromTimelineById(id), disabled: !timed },
          ]
        }
      }

      let dragSelEl = null
      if (dragSel) {
        const sx = Math.min(dragSel.x1, dragSel.x2) * view.scale + view.x
        const sy = Math.min(dragSel.y1, dragSel.y2) * view.scale + view.y
        const sw = Math.abs(dragSel.x2 - dragSel.x1) * view.scale
        const sh = Math.abs(dragSel.y2 - dragSel.y1) * view.scale
        dragSelEl = React.createElement('div', {
          style: {
            position: 'absolute', left: sx, top: sy, width: sw, height: sh,
            border: '1px dashed #4f8ef7', background: 'rgba(79,142,247,.12)', pointerEvents: 'none', zIndex: 6,
          },
        })
      }

      const showNameInput = naming || renamingGroup !== null

      const leftCol = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 } },
        React.createElement(Toolbar, {
          readOnly,
          stats,
          linkMode,
          selKind: selected ? selected.kind : null,
          selTimed: !!selTimed,
          multiCount: multi.size,
          onAddNode: addNodeCenter,
          onAddTimeline: addTimelineNode,
          onToggleLink: toggleLinkMode,
          onRename: renameSelected,
          onDisconnect: disconnectSelected,
          onRemove: removeSelected,
          onAddToTimeline: addToTimeline,
          onRemoveFromTimeline: removeFromTimeline,
          onRelayout: relayout,
          onReset: resetView,
          onSave: () => props.onSave(),
          onExport: () => props.onExport(),
          onImport: () => props.onImport(),
          onZoomIn: () => zoom(1.25),
          onZoomOut: () => zoom(0.8),
        }),
        React.createElement('div', {
          className: 'mm-timeline',
          onDoubleClick: onTlDoubleClick,
        },
          React.createElement('div', {
            className: 'mm-tl-track',
            style: { width: Math.max(400, tlX(Math.max(1, timelineNodes.length)) + 40) },
            onPointerMove: onTlPointerMove,
            onPointerUp: onTlPointerUp,
            onPointerLeave: onTlPointerUp,
          },
            React.createElement('div', { className: 'mm-tl-line' }),
            tlEls,
          ),
        ),
        React.createElement('div', {
          className: 'mm-canvas',
          onPointerDown: onBgPointerDown,
          onPointerMove: onPointerMove,
          onPointerUp: endDrag,
          onPointerLeave: endDrag,
          onPointerCancel: endDrag,
          onWheel: onWheel,
          onDoubleClick: onBgDoubleClick,
          onContextMenu: onCanvasContextMenu,
        },
          linkMode
            ? React.createElement('div', { className: 'mm-hint' },
                linkFrom === null ? '连线模式:点击第一个节点' : '连线模式:点击第二个节点(或再点同节点取消)')
            : null,
          dragSelEl,
          fogEls,
          showNameInput
            ? React.createElement('input', {
                className: 'mm-namegroup',
                autoFocus: true,
                placeholder: renamingGroup ? '输入新名称,回车确认' : '输入网络团名称,回车确认',
                value: groupName,
                onPointerDown: stopInput,
                onChange: (e) => setGroupName(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') {
                    if (renamingGroup) confirmRenameGroup()
                    else confirmGroup()
                  } else if (e.key === 'Escape') {
                    setNaming(false)
                    setRenamingGroup(null)
                    setGroupName('')
                  }
                },
                onBlur: () => { setNaming(false); setRenamingGroup(null) },
              })
            : null,
          React.createElement('div', {
            className: 'mm-viewport',
            style: { transform: 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')' },
          },
            React.createElement('svg', {
              className: 'mm-svg',
              width: 2000,
              height: 1400,
            }, edgeLines),
            edgeOverlays,
            nodeEls,
          ),
          ctxMenu
            ? React.createElement('div', {
                className: 'mm-ctxmenu',
                style: {
                  left: Math.min(ctxMenu.x, (ctxMenu.w || 900) - 170),
                  top: Math.min(ctxMenu.y, (ctxMenu.h || 560) - 230),
                },
                onPointerDown: stopInput,
              },
                ctxItems.map((item) =>
                  React.createElement('div', {
                    key: item.label,
                    className: 'mm-ctxitem' + (item.disabled ? ' disabled' : ''),
                    onClick: () => { if (!item.disabled && item.run) runCtx(item.run) },
                  }, item.label)),
              )
            : null,
        ),
      )

      const rightCol = React.createElement(GroupsPanel, {
        groups: graph.groups || [],
        onSelect: (ids) => {
          setMulti(new Set(ids))
          setSelected(ids.length > 0 ? { kind: 'node', id: ids[0] } : null)
          setCtxMenu(null)
        },
        onFocus: (ids) => {
          setMulti(new Set(ids))
          setSelected(ids.length > 0 ? { kind: 'node', id: ids[0] } : null)
          fitNodes(ids)
        },
        onRemove: (gid) => commit(removeGroupIn(graph, gid)),
        onPin: (gid, pinned) => commit(setGroupPinned(graph, gid, pinned)),
        onRename: (gid, name) => {
          setRenamingGroup({ id: gid, name })
          setGroupName(name)
          setNaming(false)
        },
      })

      return React.createElement('div', { style: { display: 'flex', flex: 1, minHeight: 0 } },
        leftCol,
        rightCol,
      )
    }

    function hashId(id) {
      let h = 0
      const s = String(id)
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
      return Math.abs(h)
    }
    const PALETTE = ['#e05252', '#4f8ef7', '#2fb36b', '#f0a03a', '#9b59b6', '#16a085', '#e67e22', '#3498db', '#c0392b', '#27ae60']

    function CordisActivationCard(props) {
      const p = props || {}
      const [open, setOpen] = useOpen()
      try {
        return React.createElement('div', { className: 'mm-act-card' },
          React.createElement('span', { className: 'mm-act-title' }, '🧠 思维导图编辑器已激活'),
          React.createElement('span', { className: 'mm-act-sub' }, 'Package ' + String(p.packageId || '?')),
          React.createElement('button', { className: 'mm-act-btn', onClick: () => setOpen(!open) },
            open ? '关闭编辑器' : '打开编辑器'),
        )
      } catch (err) {
        return crashView(err, '🧠 激活卡片渲染失败')
      }
    }

    function MindmapOverlay() {
      const [open, setOpen] = useOpen()
      const [docs, setDocs] = React.useState(null)
      const [currentId, setCurrentId] = React.useState(null)
      const [saved, setSaved] = React.useState(true)
      const [exportModal, setExportModal] = React.useState(false)
      const [renamingDoc, setRenamingDoc] = React.useState(null)

      React.useEffect(() => {
        if (!open) return
        let alive = true
        host.call('mindmap/load', {}).then((res) => {
          if (!alive) return
          const list = res && res.docs && res.docs.length > 0 ? res.docs : null
          setDocs(list)
          setCurrentId(list ? list[0].id : null)
        }).catch((err) => {
          console.error('mindmap load failed', err)
          if (alive) { setDocs([]); setCurrentId(null) }
        })
        return () => { alive = false }
      }, [open])

      if (!open || docs === null) return null

      const current = docs.find((d) => d.id === currentId) || null

      const commit = (nextGraph) => {
        if (!current) return
        setSaved(false)
        setDocs((prev) => prev.map((d) => (d.id === current.id ? { ...d, graph: nextGraph } : d)))
        const curLayout = (docs.find((d) => d.id === current.id) || {}).layout
        host.call('mindmap/save', { docId: current.id, graph: nextGraph, layout: curLayout || undefined })
          .then(() => setSaved(true))
          .catch((err) => { console.error('mindmap save failed', err); setSaved(true) })
      }
      const commitLayout = (layout) => {
        if (!current) return
        setDocs((prev) => prev.map((d) => (d.id === current.id ? { ...d, layout } : d)))
        const curGraph = (docs.find((d) => d.id === current.id) || {}).graph
        host.call('mindmap/save', { docId: current.id, layout, graph: curGraph })
          .catch((err) => { console.error('mindmap layout save failed', err) })
      }
      const createDoc = () => {
        host.call('mindmap/doc/create', { name: '未命名图像' }).then((res) => {
          if (res && res.docId) {
            setDocs((prev) => {
              const nd = { id: res.docId, name: '未命名图像', graph: defaultGraph(), layout: null }
              const next = [...prev, nd]
              setCurrentId(res.docId)
              return next
            })
          }
        }).catch((err) => console.error('create doc failed', err))
      }
      const deleteDoc = (id) => {
        host.call('mindmap/doc/delete', { docId: id }).then(() => {
          setDocs((prev) => {
            const next = prev.filter((d) => d.id !== id)
            if (currentId === id && next.length > 0) setCurrentId(next[0].id)
            return next
          })
        }).catch((err) => console.error('delete doc failed', err))
      }
      const duplicateDoc = (id) => {
        host.call('mindmap/doc/duplicate', { docId: id }).then((res) => {
          if (res && res.docId) {
            setDocs((prev) => {
              const src = prev.find((d) => d.id === id)
              const nd = {
                id: res.docId,
                name: (src ? src.name : '图像') + ' 副本',
                graph: src ? src.graph : defaultGraph(),
                layout: src ? src.layout : null,
              }
              return [...prev, nd]
            })
          }
        }).catch((err) => console.error('duplicate doc failed', err))
      }
      const confirmRenameDoc = () => {
        const name = renamingDoc && renamingDoc.name.trim()
        if (renamingDoc && name) {
          host.call('mindmap/save', { docId: renamingDoc.id, name }).then(() => {
            setDocs((prev) => prev.map((d) => (d.id === renamingDoc.id ? { ...d, name } : d)))
          }).catch((err) => console.error('rename doc failed', err))
        }
        setRenamingDoc(null)
      }
      const saveNow = () => {
        if (!current) return
        setSaved(false)
        host.call('mindmap/save', { docId: current.id, graph: current.graph, layout: current.layout || undefined })
          .then(() => setSaved(true))
          .catch((err) => { console.error('save failed', err); setSaved(true) })
      }
      // 导出数据:包含 layout(节点位置/固定团布局),导入时原样恢复
      const doExport = (kind) => {
        setExportModal(false)
        if (!current) return
        const base = String(current.name || 'mindmap').replace(/[\\/:*?"<>|]/g, '_')
        if (kind === 'data') {
          const payload = { name: current.name, graph: current.graph }
          if (current.layout) payload.layout = current.layout
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
          downloadBlob(blob, base + '.json')
        } else {
          const svg = buildSvg(current.graph, current.layout || {})
          const blob = new Blob([svg], { type: 'image/svg+xml' })
          downloadBlob(blob, base + '.svg')
        }
      }
      const pickImportFile = () => {
        try {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.json,application/json'
          input.onchange = () => {
            const file = input.files && input.files[0]
            if (file) importFile(file)
            input.remove()
          }
          document.body.appendChild(input)
          input.click()
        } catch (err) {
          console.error('file picker unavailable', err)
        }
      }
      // 导入:兼容 { graph } 包装 / 直接 graph,并恢复 layout(固定团布局)
      const importFile = (file) => {
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const data = JSON.parse(String(reader.result))
            let graph = data
            let layout = null
            if (graph && graph.graph && Array.isArray(graph.graph.nodes)) {
              layout = graph.layout && typeof graph.layout === 'object' ? graph.layout : null
              graph = graph.graph
            }
            if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
              console.error('invalid import data')
              return
            }
            const name = (data && data.name) || (file.name || '导入图像').replace(/\.json$/i, '') || '导入图像'
            host.call('mindmap/doc/import', { name, graph, layout }).then((res) => {
              if (res && res.docId) {
                setDocs((prev) => {
                  const nd = { id: res.docId, name, graph, layout }
                  const next = [...prev, nd]
                  setCurrentId(res.docId)
                  return next
                })
              }
            }).catch((err) => console.error('import failed', err))
          } catch (err2) {
            console.error('import parse failed', err2)
          }
        }
        reader.readAsText(file)
      }

      if (!current) {
        return React.createElement('div', {
          className: 'mm-overlay',
          onPointerDown: (e) => { if (e.target === e.currentTarget) setOpen(false) },
        },
          React.createElement('div', { className: 'mm-panel' },
            React.createElement('div', { className: 'mm-panel-head' },
              React.createElement('span', { className: 'mm-title' }, '🧠 思维导图'),
              React.createElement('button', { className: 'mm-close', onClick: () => setOpen(false) }, '✕'),
            ),
            React.createElement('div', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 } },
              React.createElement('span', { style: { opacity: .7 } }, '还没有图像,点击下方新建'),
              React.createElement('button', { className: 'mm-tbtn', onClick: createDoc }, '＋ 新建图像'),
            ),
          ),
        )
      }

      try {
        return React.createElement('div', {
          className: 'mm-overlay',
          onPointerDown: (e) => { if (e.target === e.currentTarget) setOpen(false) },
        },
          React.createElement('div', { className: 'mm-panel' },
            React.createElement('div', { className: 'mm-panel-head' },
              React.createElement('span', { className: 'mm-title' }, '🧠 思维导图 · ' + current.name),
              React.createElement('span', { className: 'mm-save-state' }, saved ? '已保存' : '保存中…'),
              React.createElement('button', { className: 'mm-close', onClick: () => setOpen(false), title: '关闭' }, '✕'),
            ),
            React.createElement('div', { style: { display: 'flex', flex: 1, minHeight: 0 } },
              React.createElement(DocsPanel, {
                docs,
                currentId,
                onSelect: (id) => setCurrentId(id),
                onCreate: createDoc,
                onDelete: deleteDoc,
                onRename: (id, name) => setRenamingDoc({ id, name }),
                onDuplicate: duplicateDoc,
              }),
              React.createElement(MindmapEditor, {
                key: current.id,
                graph: current.graph,
                initialLayout: current.layout || null,
                onChange: commit,
                onLayoutChange: commitLayout,
                onSave: saveNow,
                onExport: () => setExportModal(true),
                onImport: pickImportFile,
              }),
            ),
            exportModal
              ? React.createElement('div', { className: 'mm-modal' },
                  React.createElement('div', { className: 'mm-modal-title' }, '选择导出形式'),
                  React.createElement('div', { className: 'mm-modal-actions' },
                    React.createElement('button', { className: 'mm-tbtn', onClick: () => doExport('data') }, '数据 (JSON)'),
                    React.createElement('button', { className: 'mm-tbtn', onClick: () => doExport('image') }, '图像 (SVG)'),
                    React.createElement('button', { className: 'mm-tbtn', onClick: () => setExportModal(false) }, '取消'),
                  ),
                )
              : null,
            renamingDoc
              ? React.createElement('div', { className: 'mm-modal' },
                  React.createElement('div', { className: 'mm-modal-title' }, '重命名图像'),
                  React.createElement('input', {
                    style: { width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 8, border: '1px solid #4f8ef7', outline: 'none', fontSize: 13, background: '#fff', color: '#111' },
                    autoFocus: true,
                    value: renamingDoc.name,
                    onChange: (e) => setRenamingDoc({ ...renamingDoc, name: e.target.value }),
                    onKeyDown: (e) => {
                      if (e.key === 'Enter') confirmRenameDoc()
                      else if (e.key === 'Escape') setRenamingDoc(null)
                    },
                    onBlur: confirmRenameDoc,
                  }),
                )
              : null,
          ),
        )
      } catch (err) {
        return crashView(err, '🧠 面板渲染失败')
      }
    }

    function MindmapButton() {
      try {
        return React.createElement('button', {
          className: 'mm-hbtn',
          title: '思维导图',
          'aria-label': '打开思维导图编辑器',
          onClick: () => store.setOpen(!store.open),
        }, '🧠')
      } catch (err) {
        return crashView(err, '🧠 按钮渲染失败')
      }
    }

    slots.inject('tool.view.cordis', () => slots.register(
      { name: 'tool.view.cordis', key: 'self' },
      (props) => React.createElement(CordisActivationCard, props || {}),
    ))

    slots.inject('conversation.session.header.actions', () => slots.register(
      { name: 'conversation.session.header.actions', id: 'mindmap.open', order: 30, label: '思维导图' },
      (props) => React.createElement(MindmapButton, props || {}),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'mindmap.overlay', order: 20, label: '思维导图' },
      () => React.createElement(MindmapOverlay, null),
    ))
  },
}
