# time_line_mind

> **DSH Plugin** · DeepSeek Harness 动态 Cordis 插件 · 思维导图(网络图 + 时间轴)编辑器

一个运行在 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 浏览器端的**无向图思维导图编辑器**。没有父子层级,只有节点与连线;顶部带一条独立时间轴;支持多图档、多选/框选、网络团(可固定)、雾团浏览、导入导出。

## 特性

- **无向图网络**:节点自由连接,力导向分块布局(环感知:不同回路互斥、连线少穿插、节点永不重叠)
- **时间轴**:顶部独立轨道,节点可入轴/出轴、拖拽重排;双击时间轴节点聚焦网络视图
- **连线命名**:每条连线可命名,标签自动避让节点、互不错位
- **多选 / 框选**:Ctrl+单击 或 Ctrl+拖框 多选,批量拖拽、复制、断开、命名网络团
- **网络团**:把一组节点命名成"团",右侧面板管理;支持**固定**(团作为整体移动、复位布局保持团内相对位置)
- **多图档**:左侧图像列表,新建/删除/重命名/复制/切换;布局(含固定团)自动落盘
- **雾团浏览**:缩小时按连通块折叠为雾团(名称:时间节点 → 网络团 → 雾团N)
- **保存 / 导出 / 导入**:保存到本地;导出数据(JSON,含布局)或图像(SVG);导入数据文件(可分享)
- **语义缩放**:以鼠标为中心缩放;复位视图可居中选中或适配全部

## 安装

这是一个 **DSH 动态 Cordis 插件**(进程级),通过 `cordis_define` 加载:

1. 在 DSH 会话中调用 `cordis_define`(kind: `new`, idPrefix 建议 `mindm`);
2. `code.host` 填入 [`src/host.js`](src/host.js) 的内容;
3. `code.client` 填入 [`src/client.js`](src/client.js) 的内容;
4. `cordis_run` 激活并授权,刷新页面后从**会话标题栏右侧 🧠 按钮**或对话流 Cordis 激活卡片打开编辑器。

详细说明见 [`docs/mindmap-plugin.md`](docs/mindmap-plugin.md)。

## 自动重载(推荐)

动态插件定义存在 DSH 进程内存,DSH 重启即清空——这是设计特性。项目附带一个**自动重载器组合插件**(`autoload/`):DSH 每次启动时,它会自动为新会话 `define + run` 本插件,**你不再需要手动粘贴源码**。

安装(一次性,需要 dsh CLI 或 DSH 源码 checkout):

```sh
# 在 DSH 源码 checkout 目录,或已安装 dsh CLI 的环境:
pnpm dsh plugin --profile web add ./time_line_mind/autoload
# 或:dsh plugin --profile web add ./time_line_mind/autoload
```

安装后**重启 DSH** 生效。之后每次启动:

1. 打开 Web 界面,会话创建时自动重载器会恢复插件;
2. 对话流出现 Cordis 审批卡片,点一次 **✓ 批准**(每次重启只需这一步,因为审批状态也在内存中);
3. 刷新页面,从标题栏 **🧠 按钮** 打开编辑器;图档数据从工作区 `mindmap-docs.json` 自动读回。

> 自动重载器是**进程级单实例**:整个 DSH 进程只恢复一个实例(挂在第一个出现的用户会话下),图档数据在 host 侧全局共享、UI 全局可用——不随会话数量重复。卸载:`pnpm dsh plugin --profile web remove time-line-mind-autoload`。

## 手动恢复(兜底)

动态插件的**代码定义存在 DSH 进程内存**里,DSH 重启后定义会被清空——这是动态插件的设计特性,不是故障。**你的数据不会丢**:图档数据已落盘在工作区 `mindmap-docs.json`,重新加载插件后会自动读回。

重启后恢复只需两步:

1. **重新加载插件**——把下面这段话发给 agent(或按上方「安装」步骤手动执行):

   > 请重新加载 time_line_mind 思维导图插件:读取本工作区 `time_line_mind/src/host.js` 与 `time_line_mind/src/client.js` 的内容,分别作为 `cordis_define` 的 `code.host` 与 `code.client`(kind: `new`, idPrefix: `mindm`),然后 `cordis_run` 激活。

2. **刷新浏览器页面**,从会话标题栏右侧 **🧠 按钮** 或对话流 Cordis 激活卡片打开编辑器。

> 提示:如果重启后打开的会话工作区不是本项目的上一级目录,先把会话工作区切到包含 `time_line_mind/` 的目录,或直接用 GitHub 上 [`src/host.js`](src/host.js) / [`src/client.js`](src/client.js) 的源码内容。

## 数据格式

```json
{
  "nodes": [ { "id": "n1", "title": "中心主题", "time": 0 } ],
  "edges": [ { "source": "n1", "target": "n2", "title": "连接名" } ],
  "groups": [ { "id": "g1", "name": "阶段一", "nodeIds": ["n1","n2"], "pinned": false } ]
}
```

- `node.time` 存在 = 同时在顶部时间轴(按 time 升序)。
- `edge.title` = 连线名(边中点标签)。
- `groups` = 网络团;`pinned` = 固定为整体。
- 节点位置(`layout`)随文档持久化并随导出/导入传递。

## 交互速查

| 操作 | 方式 |
|---|---|
| 添加节点 | 「＋节点」或双击画布空白(自动找空位) |
| 添加时间轴节点 | 「＋时间轴」或双击时间轴空白 |
| 连线 | 「连线」模式依次点两个节点;右键「加节点」创建相连节点 |
| 连线命名 | 双击连线/标签,或选中后「重命名」 |
| 改名 | 双击节点/连线 |
| 删除/断开/入轴/出轴 | 工具栏或右键(入轴/出轴互斥置灰) |
| 复位布局 | 连通块按时间轴顺序;块内时间轴横排 + 力导向(环感知/碰撞分离) |
| 复位视图 | 有选中→居中选中;无选中→适配全部 |
| 多选/框选 | Ctrl+单击 / Ctrl+拖框;拖任一选中节点整组平移 |
| 网络团 | 多选后右键「命名网络团」;右侧面板:固定/松开/重命名/删除/双击聚焦 |
| 雾团 | 缩放 < 0.45 时按连通块折叠,点击聚焦 |
| 保存/导出/导入 | 工具栏右侧;导出可选 数据(JSON)/图像(SVG) |

## 结构

```
src/
  host.js     插件 Host 半区(内存存储/落盘/导出/诊断工具)
  client.js   插件 Client 半区(编辑器 UI:网络/时间轴/多图档/网络团/导入导出)
autoload/
  index.js    自动重载器组合插件(由 build.js 从 src/ 生成,内联源码)
  build.js    重新生成 autoload/index.js 的脚本
docs/
  mindmap-plugin.md  完整文档与踩坑记录
```

## License

[MIT](LICENSE)
