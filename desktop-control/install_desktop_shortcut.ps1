# Harness Desktop Control — 在桌面创建快捷方式
# 用法（在 PowerShell 中）：
#   powershell -ExecutionPolicy Bypass -File .\install_desktop_shortcut.ps1
# 或右键“使用 PowerShell 运行”。

$ErrorActionPreference = 'Stop'

# 脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetScript = Join-Path $ScriptDir 'harness_control.py'
$IconPath = Join-Path $ScriptDir 'assets\harness.ico'

if (-not (Test-Path -LiteralPath $TargetScript)) {
    Write-Error "找不到 $TargetScript"
    exit 1
}

# 定位 pythonw.exe（无控制台窗口的 Python 启动器）
# 优先找真实 Python 安装，避免选中 WindowsApps 的 pythonw 别名。
$Pythonw = $null

# 1) 常见真实安装位置
$candidateBases = @(
    (Join-Path $env:LOCALAPPDATA 'Python\bin'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python'),
    (Join-Path $env:LOCALAPPDATA 'Python'),
    'C:\Python314',
    'C:\Python313',
    'C:\Python312',
    'C:\Python311',
    'C:\Python310'
)
foreach ($base in $candidateBases) {
    if (-not (Test-Path -LiteralPath $base)) { continue }
    $found = Get-ChildItem -Path $base -Filter 'pythonw.exe' -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notlike '*WindowsApps*' } |
        Select-Object -First 1
    if ($found) {
        $Pythonw = $found.FullName
        break
    }
}

# 2) PATH 中的 pythonw.exe（排除 WindowsApps 别名）
if (-not $Pythonw) {
    $cmd = Get-Command pythonw.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -and $_.Source -notlike '*WindowsApps*' } |
        Select-Object -First 1
    if ($cmd) { $Pythonw = $cmd.Source }
}

# 3) 通过 py 启动器反查 python.exe，再推导 pythonw.exe
if (-not $Pythonw) {
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        $pyOut = & $py.Source -c "import sys; print(sys.executable)" 2>$null
        if ($pyOut) {
            $pyExe = $pyOut.Trim()
            if ($pyExe) {
                $candidate = Join-Path (Split-Path -Parent $pyExe) 'pythonw.exe'
                if (Test-Path -LiteralPath $candidate) { $Pythonw = $candidate }
            }
        }
    }
}

if (-not $Pythonw) {
    Write-Error '未找到 pythonw.exe。请先安装 Python，并确保 pythonw 在 PATH 中。'
    exit 1
}

$Desktop = [Environment]::GetFolderPath('Desktop')
$LnkPath = Join-Path $Desktop 'Harness 控制器.lnk'

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($LnkPath)
$Shortcut.TargetPath = $Pythonw
$Shortcut.Arguments = "`"$TargetScript`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = 'DeepSeek Harness 桌面控制器：启动 / 关闭 / 重启 Harness'
if (Test-Path -LiteralPath $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
}
$Shortcut.Save()

Write-Host "已创建桌面快捷方式：$LnkPath"
Write-Host "目标程序：$Pythonw"
Write-Host "参数：`"$TargetScript`""
