# 🎮 Cocos Creator 资源处理完整解决方案

一套完整的 Cocos Creator 资源处理工具，包含 Web 服务器、图集切割、格式转换等功能。

## ✨ 核心功能

### 🌐 Web 服务器
- ✅ 美观的 Web 界面
- ✅ 拖拽上传文件夹/ZIP
- ✅ 实时任务队列管理
- ✅ 进度条显示
- ✅ 结果自动下载

### 🔧 资源处理
- ✅ 图集切割（支持旋转帧）
- ✅ JSON 转 plist 格式
- ✅ 批量处理
- ✅ 自动化流程

### 📦 文件处理
- ✅ ZIP 自动解压
- ✅ 保持目录结构
- ✅ 结果打包下载
- ✅ 自动清理临时文件

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务器
```bash
npm run server:dev
```

### 3. 访问网页
```
http://localhost:3000
```

### 4. 上传处理
- 拖拽文件夹或 ZIP 到网页
- 等待自动处理
- 下载处理结果

就这么简单！🎉

## 📂 项目结构

```
cocosRes/
├── src/
│   ├── server.ts                    # 🌐 Web 服务器
│   ├── dealRes.ts                   # 🔧 资源处理主逻辑
│   ├── slice-atlas.ts               # ✂️ 图集切割
│   ├── json-to-plist-converter.ts   # 📝 格式转换
│   ├── atlas-tools.ts               # 🛠️ 工具集合
│   └── index.ts                     # 📦 批处理入口
│
├── static/
│   ├── index.html                   # 🎨 Web 界面
│   ├── style.css                    # 💅 样式
│   └── app.js                       # ⚡ 前端逻辑
│
├── res/                             # 📁 资源目录
├── uploads/                         # 📤 上传临时目录
├── output/                          # 📦 输出目录
│
└── 文档/
    ├── START_SERVER.md              # ⚡ 快速启动
    ├── SERVER_README.md             # 📖 服务器文档
    ├── 切图工具说明.md               # ✂️ 切图说明
    ├── README-converter.md          # 📝 转换文档
    └── 命令速查.md                   # 📋 命令参考
```

## 🎯 使用场景

### 场景 1：Web 界面处理
1. 打开 http://localhost:3000
2. 拖拽资源文件夹/ZIP
3. 等待处理完成
4. 下载结果

### 场景 2：命令行处理
```bash
# 单个图集切割
npm run tools slice image.png image.plist

# 批量转换
npm run tools batch-convert ./import ./output

# 完整流程
npm run tools full input.json image.png ./output
```

### 场景 3：代码集成
```typescript
import { sliceAtlas } from './src/slice-atlas';
import { convertJSONToPlist } from './src/json-to-plist-converter';

// 切割图集
await sliceAtlas('image.png', 'image.plist');

// 转换格式
convertJSONToPlist('input.json', 'output.plist');
```

## 📊 功能对比

| 功能 | Web 界面 | 命令行 | 代码调用 |
|------|---------|--------|---------|
| 上传文件 | ✅ | ❌ | ❌ |
| 图集切割 | ✅ | ✅ | ✅ |
| 格式转换 | ✅ | ✅ | ✅ |
| 批量处理 | ✅ | ✅ | ✅ |
| 进度显示 | ✅ | ✅ | ❌ |
| 结果下载 | ✅ | ❌ | ❌ |
| 易用性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

## 🛠️ 可用命令

```bash
# 服务器相关
npm run server          # 启动服务器
npm run server:dev      # 开发模式（自动重启）
npm start              # 生产模式

# 工具相关
npm run slice          # 切割图集
npm run convert        # 格式转换
npm run tools          # 工具集合
npm run build          # 编译 TypeScript

# 查看帮助
npm run help
```

## 📚 详细文档

- **[快速启动](START_SERVER.md)** - 5分钟上手指南
- **[服务器文档](SERVER_README.md)** - 完整 API 和配置
- **[切图工具](切图工具说明.md)** - 图集切割详解
- **[格式转换](README-converter.md)** - JSON 转 plist
- **[命令速查](命令速查.md)** - 常用命令参考

## 🎨 Web 界面预览

### 主页面
- 渐变背景
- 拖拽上传区
- 实时统计卡片
- 任务列表

### 功能展示
- 📤 上传：拖拽文件夹/ZIP
- 📊 统计：排队/处理中/完成/失败
- 📋 任务：列表展示、进度条
- 📥 下载：一键下载结果
- 🔔 通知：Toast 提示

## 🔌 API 接口

```bash
POST   /api/upload          # 上传文件
GET    /api/task/:id        # 获取任务状态
GET    /api/tasks           # 获取所有任务
GET    /api/download/:id    # 下载结果
DELETE /api/task/:id        # 删除任务
GET    /api/health          # 健康检查
```

## ⚡ 性能特点

- 🚀 异步处理，不阻塞
- 📦 流式上传，支持大文件
- ⚙️ 任务队列，有序处理
- 💾 自动清理，节省空间
- 📊 实时进度，用户友好

## 🎯 核心优势

1. **开箱即用** - 无需复杂配置
2. **界面友好** - 现代化 Web UI
3. **功能完整** - 涵盖所有需求
4. **高度可扩展** - 易于添加新功能
5. **完善文档** - 详细的使用说明

## 🔧 技术栈

### 后端
- TypeScript
- Express.js
- Multer (文件上传)
- AdmZip (ZIP 处理)
- Sharp (图片处理)
- xml2js (XML 解析)

### 前端
- 原生 JavaScript
- CSS3 (渐变、动画)
- HTML5 (拖拽 API)
- Fetch API

## 📝 TODO

- [ ] 支持多任务并发处理
- [ ] 添加用户认证
- [ ] 支持处理历史记录
- [ ] 添加更多资源处理类型
- [ ] 支持自定义处理流程
- [ ] 添加处理结果预览

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🎉 开始使用

现在就开始使用吧！

```bash
# 1. 安装依赖
npm install

# 2. 启动服务器
npm run server:dev

# 3. 打开浏览器
# http://localhost:3000

# 4. 拖拽文件，开始处理！
```

---

**祝你使用愉快！** 🚀✨
