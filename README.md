# Cocos Creator 图集工具集

一套完整的 Cocos Creator 图集处理工具，包括格式转换和图片切割功能。

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 基础使用

```bash
# 1. JSON 转 plist
ts-node atlas-tools.ts convert input.json output.plist

# 2. 切割图集
ts-node atlas-tools.ts slice atlas.png atlas.plist

# 3. 完整流程（JSON -> plist -> 切图）
ts-node atlas-tools.ts full input.json atlas.png ./output
```

## 📦 工具列表

### 1. JSON 转 plist 转换器（json-to-plist-converter.ts）

将 Cocos Creator 编译后的 JSON 图集文件转换为标准 plist 格式。

**功能：**
- ✅ 解析 Cocos Creator JSON 格式
- ✅ 生成标准 Apple Property List XML
- ✅ 支持单文件和批量转换
- ✅ 自动提取图集名称和帧信息

**使用：**
```bash
# 单文件转换
node json-to-plist-converter.js input.json output.plist

# 批量转换
node json-to-plist-converter.js ./input-dir --dir ./output-dir
```

### 2. 图集切图工具（slice-atlas.ts）

根据 plist 文件将图集切分为单独的图片。

**功能：**
- ✅ 解析标准 plist 格式
- ✅ 高性能图片切割（使用 sharp）
- ✅ 支持旋转帧处理
- ✅ 批量处理多个图集

**使用：**
```bash
# 切割单个图集
ts-node slice-atlas.ts image.png image.plist

# 指定输出目录
ts-node slice-atlas.ts image.png image.plist ./output

# 批量切割
ts-node slice-atlas.ts ./atlas-dir --batch
```

### 3. 图集工具集（atlas-tools.ts）

整合所有功能的统一入口。

**使用：**
```bash
# 查看帮助
ts-node atlas-tools.ts --help

# 转换
ts-node atlas-tools.ts convert <json> [plist]

# 切图
ts-node atlas-tools.ts slice <image> <plist> [output]

# 批量转换
ts-node atlas-tools.ts batch-convert <dir> [output]

# 批量切图
ts-node atlas-tools.ts batch-slice <dir>

# 完整流程
ts-node atlas-tools.ts full <json> <image> [output]
```

## 📖 使用场景

### 场景 1：导出 Cocos Creator 资源

```bash
# 假设你的项目构建输出在 build/web-mobile
cd build/web-mobile/assets/resources

# 1. 将 JSON 转为 plist
ts-node ../../../../atlas-tools.ts batch-convert ./import ./plist-output

# 2. 切割图集（如果需要）
ts-node ../../../../atlas-tools.ts batch-slice ./textures
```

### 场景 2：单个图集完整处理

```bash
# 一条命令完成 JSON -> plist -> 切图
ts-node atlas-tools.ts full \
  "D:\work\test\fnt\build\web-mobile\assets\resources\import\0f\0faa447ee.json" \
  "D:\work\test\fnt\assets\resources\pic\hetu.png" \
  "./output"
```

### 场景 3：在代码中使用

```typescript
import { convertJSONToPlist } from './json-to-plist-converter';
import { sliceAtlas } from './slice-atlas';

// 转换 JSON
convertJSONToPlist('input.json', 'output.plist');

// 切图
await sliceAtlas('image.png', 'image.plist', './output');
```

## 📁 项目结构

```
cocosRes/
├── atlas-tools.ts                  # 统一工具入口
├── json-to-plist-converter.ts      # JSON 转 plist
├── slice-atlas.ts                  # 图集切图
├── slice-example.ts                # 切图示例
├── example-usage.js                # 转换示例
├── package.json                    # 依赖配置
├── README.md                       # 本文件
├── README-converter.md             # 转换器详细文档
├── 切图工具说明.md                  # 切图工具详细文档
└── QUICKSTART.md                   # 快速开始指南
```

## 🛠️ 技术栈

- **TypeScript** - 类型安全
- **Node.js** - 运行环境
- **sharp** - 高性能图片处理
- **xml2js** - XML 解析

## 📋 系统要求

- Node.js >= 14.0.0
- npm >= 6.0.0

## 🎯 实际案例

### 案例 1：hetu 图集处理

```bash
# 输入文件
# - 0faa447ee.json (Cocos Creator 导出)
# - hetu.png (图集图片)

# 步骤 1: 转换 JSON
ts-node atlas-tools.ts convert \
  "D:\work\test\fnt\build\web-mobile\assets\resources\import\0f\0faa447ee.json" \
  "D:\work\test\fnt\assets\resources\pic\hetu.plist"

# 步骤 2: 切图
ts-node atlas-tools.ts slice \
  "D:\work\test\fnt\assets\resources\pic\hetu.png" \
  "D:\work\test\fnt\assets\resources\pic\hetu.plist"

# 结果：
# hetu/
#   ├── Game-70_100%.png
#   ├── Game-70_100EXTRA.png
#   ├── Game-70_200%.png
#   ├── Game-70_50%.png
#   └── Game-70_Text_Amazing.png
```

### 案例 2：activity-album 批量处理

```bash
# 批量转换所有 JSON
ts-node atlas-tools.ts batch-convert \
  "d:\suyu\cocosRes\activity-album\import\01" \
  "d:\suyu\cocosRes\activity-album\plist"

# 批量切图
ts-node atlas-tools.ts batch-slice \
  "d:\suyu\cocosRes\activity-album\out\res\pic"
```

## 📝 输出格式

### plist 输出示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>frames</key>
        <dict>
            <key>Game-70_100%.png</key>
            <dict>
                <key>spriteOffset</key>
                <string>{0,0}</string>
                <key>spriteSize</key>
                <string>{80,31}</string>
                <key>textureRect</key>
                <string>{{72,0},{80,31}}</string>
                <key>textureRotated</key>
                <false/>
            </dict>
            <!-- 更多帧... -->
        </dict>
        <key>metadata</key>
        <dict>
            <key>textureFileName</key>
            <string>hetu.png</string>
            <key>size</key>
            <string>{319,131}</string>
        </dict>
    </dict>
</plist>
```

### 切图输出结构

```
原图片目录/
├── atlas.png          # 原图集
├── atlas.plist        # plist 文件
└── atlas/             # 切图输出目录
    ├── sprite1.png
    ├── sprite2.png
    └── sprite3.png
```

## 🔧 常见问题

### Q: Windows 路径怎么写？

A: 使用双反斜杠或正斜杠：
```bash
"D:\\path\\to\\file"  # 双反斜杠
"D:/path/to/file"     # 正斜杠（推荐）
```

### Q: 如何批量处理多个文件？

A: 使用 `batch-convert` 或 `batch-slice` 命令。

### Q: 切出来的图片在哪里？

A: 默认在原图片同目录下，创建一个与图片同名的文件夹。

### Q: 支持哪些图片格式？

A: 输入支持 PNG、JPG、JPEG，输出为 PNG 格式。

### Q: 如何处理旋转的帧？

A: 切图工具会自动检测并处理 plist 中标记为 rotated 的帧。

## 📚 详细文档

- [JSON 转 plist 完整文档](./README-converter.md)
- [切图工具详细说明](./切图工具说明.md)
- [快速开始指南](./QUICKSTART.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关工具

- [Cocos Creator](https://www.cocos.com/creator)
- [TexturePacker](https://www.codeandweb.com/texturepacker)
- [sharp](https://sharp.pixelplumbing.com/)

## ⚡ 性能

- JSON 转换：毫秒级
- 单个图集切割：< 1 秒
- 批量处理：并行处理，高效快速

## 🎉 特性

- 🚀 高性能
- 📦 零配置
- 🎯 简单易用
- 🔧 功能完整
- 📝 文档齐全
- ✅ 类型安全

---

**Happy Coding! 🎮**
