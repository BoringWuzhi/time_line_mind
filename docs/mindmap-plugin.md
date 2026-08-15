# 思维导图 Harness 插件(mindm-1)

动态 Cordis 插件,当前 **pkg-17**。会话标题栏右侧 🧠 按钮打开全屏浮层编辑器。无向图网络 + 时间轴 + 连线命名 + 多选/网络团 + **多图档/雾团/导入导出**。

## 架构

```
Host 半区(DSH Node 进程)
├─ mindmap/load | save | reset          多图档存储(按 sessionId)
├─ mindmap/doc/create|delete|duplicate|import  图档 CRUD + 导入
├─ mindmap/export-data|export-image     导出 JSON / SVG 到工作区
├─ persist(): 落盘 mindmap-docs.json(布局含固定团)
├─ normalizeGraph                       阶段一工具规范化
└─ mindmap_diag                         浏览器端诊断工具
        ▲ host.call(Client → Host)
        │
Client 半区(浏览器)
├─ tool.view.cordis                    激活卡片
├─ conversation.session.header.actions 会话标题栏 🧠 按钮
├─ shell.overlay                       全屏浮层面板
│   ├─ 左侧:图像列表(多图档)
│   ├─ 中部:工具栏 / 时间轴 / 网络画布(雾团)
│   └─ 右侧:网络团面板
└─ MindmapEditor 支持 readOnly(阶段一复用)
```

## 数据格式(统一规范)

```json
{
  "docs": [{
    "id": "doc-xxx", "name": "未命名图像",
    "graph": {
      "nodes": [{ "id": "n1", "title": "中心主题", "time": 0 }],
      "edges": [{ "source": "n1", "target": "n2", "title": "连接名" }],
      "groups": [{ "id": "g1", "name": "阶段一", "nodeIds": ["n1","n2"], "pinned": false }]
    },
    "layout": { "n1": { "x": 100, "y": 200 } }
  }]
}
```

- `layout` = 节点位置(渲染态,现随文档**持久化**,固定团布局重开后保留)。
- 落盘文件:工作区 `mindmap-docs.json`(自动);导出 `mindmap-export-<名>.json/.svg`。

## 交互速查

### 网络画布
| 操作 | 方式 |
|---|---|
| 添加节点 | 「＋节点」或双击画布空白(自动找空位) |
| 添加时间轴节点 | 「＋时间轴」或双击时间轴空白 |
| 建立连接 | 「连线」模式;右键「加节点」创建相连节点 |
| 连线命名 | 双击连线/标签,或选中后「重命名」(标签自动避让节点) |
| 改名 | 双击节点/连线 |
| 删除/断开/入轴/出轴 | 工具栏或右键(入轴/出轴互斥置灰) |
| 复位布局 | 连通块按时间轴顺序;块内时间轴横排 + 力导向(环质心/异环斥力/碰撞分离) |
| 复位视图 | 有选中→居中选中;无选中→适配全部节点 |
| 平移/缩放 | 空白拖拽 / 滚轮(以鼠标为中心) |
| 雾团 | 缩放 < 0.45 时按连通块折叠:名称 = 时间节点 → 网络团名 → 雾团N;点击聚焦 |
| 双击时间轴节点 | 视图居中聚焦该节点 |

### 多选 / 框选 / 批量
- Ctrl+单击 多选;Ctrl+拖拽空白 框选;拖任一选中节点整组平移;
- 多选右键:删除 / 复制(含边标签)/ 命名网络团 / 断开;
- 网络团:单击选中成员,双击聚焦视图;固定 / 松开(互斥)/ 重命名 / 删除。

### 多图档(左侧)
- 新建 / 删除 / 重命名 / 复制 / 切换;布局(含固定团)自动落盘;
- 导入:选择 JSON 数据文件 → 作为新图像载入(可分享给他人)。

### 工具栏右侧
- **保存**:当前图像落盘;
- **导出**:弹框选 数据(JSON)或 图像(SVG),写入工作区;
- **导入**:选择导出的 JSON 文件载入。

## 阶段一接入指南(对话流渲染)

1. **Host** 追加 `mindmap` 工具(defineTool 硬性要求见「踩坑记录」):

   ```js
   const tool = harness.defineTool({
     name: 'mindmap',
     description: '渲染一幅无向图思维导图。传入 { nodes, edges, groups? }。',
     parameters: {
       type: 'object',
       properties: { graph: { type: 'object', additionalProperties: true } },
       required: ['graph'], additionalProperties: true,
     },
     output: { schema: { type: 'object', properties: {}, additionalProperties: true }, render: (a, v) => [{ type: 'text', text: JSON.stringify(v) }] },
     execute: async (args, exec) => {
       const graph = normalizeGraph(args && args.graph)
       if (!graph) return { ok: false, error: 'invalid graph' }
       // stores.get('default').docs.push({ id:..., name: 'AI 生成', graph, layout: null })
       return { ok: true, graph, stats: { nodes: graph.nodes.length, edges: graph.edges.length } }
     },
   })
   harness.registerTool(ctx, tool)
   ```

2. **Client** 注册 `tool.call.toolview`(key 'mindmap')复用 `MindmapEditor` readOnly。

## 踩坑记录(重要)

1. **defineTool**:parameters.additionalProperties true/省略;output { schema, render };execute 在 defineTool 内;output.schema.additionalProperties 显式。
2. **sidebar.footer.action 被 CordisPanel 独占**(width:100%;flex:none),入口放 `conversation.session.header.actions`。
3. **动态插件定义进程内存级**:DSH 重启即丢定义,需重新 define+run;文档数据会从 `mindmap-docs.json` 恢复(若 fs 可用)。
4. **diagnostics**:`dynamicCordisRunner.snapshot(agent)` 必须传 agent(动态工具用 exec.agent)。
5. **渲染错误不显示时**:查 F12 console `[cordis:mindm-1]`、`mindmap_diag`、刷新页面。
6. **HTML 元素不能放进 `<svg>`**(边标签/输入框渲染在 SVG 外)。
7. **forEach 回调里不能用 continue**(用 for...of 或 return)。
8. **导出图像为 SVG 文本**(fs 仅支持文本写入;SVG 可由浏览器/工具转 PNG)。

## 生命周期

| 操作 | 工具 |
|---|---|
| 更新代码 | `cordis_define`(existing, 追加 Package)→ `cordis_run`(update) |
| 临时停用 | `cordis_stop` |
| 彻底删除 | `cordis_undefine` |
