# Harness 桌面控制器（Desktop Control）

一个**不依赖 Harness 本身**、可以独立运行的 Windows 桌面小工具，用于：

- **启动** DeepSeek Harness
- **关闭** DeepSeek Harness
- **重启** DeepSeek Harness

窗口参考和风样式指南进行**彻底重设**（和纸白、绀青、洗朱、竹、枫叶、破墨线、朱砂锚点、茣蓙目纹理、渗纸卡片、墨润按钮），启动后会出现在任务栏，可固定到任务栏；窗口右上角有“说明书”按钮，可直接打开说明书。

> 详细说明、配置、工作原理和注意事项请见 **[说明书.md](说明书.md)**。

## 快速开始

```powershell
cd D:\develop\WorkSpeace\TEMP\time_line_mind\desktop-control
powershell -ExecutionPolicy Bypass -File .\install_desktop_shortcut.ps1
```

执行后桌面会出现“Harness 控制器.lnk”，双击即可打开控制器。

手动运行：

```powershell
pythonw.exe .\harness_control.py
```

## 目录

```
desktop-control/
  package.json                  项目元数据与快捷脚本
  harness_control.py            桌面控制器主程序（和风 UI）
  config.json                   配置
  install_desktop_shortcut.ps1  创建桌面快捷方式
  run_controller.bat            无控制台窗口启动控制器
  generate_icon.py              生成图标
  assets/harness.ico            桌面/任务栏图标
  说明书.md                     完整说明书
  state/                        运行时状态（PID、日志）
```

## 默认配置

```json
{
  "name": "DeepSeek Harness",
  "command": ["dsh", "--profile", "web"],
  "url": "http://127.0.0.1:3080",
  "open_browser": true,
  "port": 3080
}
```

更详细的配置说明见 [说明书.md](说明书.md)。
