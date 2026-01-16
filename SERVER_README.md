# Cocos 资源处理服务器

一个完整的 Web 服务，用于上传和处理 Cocos Creator 资源文件。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

#### 开发模式（自动重启）
```bash
npm run server:dev
```

#### 生产模式
```bash
npm start
```

#### 直接运行
```bash
npm run server
```

### 3. 访问网页

打开浏览器访问：
```
http://localhost:3000
```

## 📁 项目结构

```
cocosRes/
├── src/
│   ├── server.ts              # 服务器主文件
│   ├── dealRes.ts             # 资源处理逻辑
│   ├── slice-atlas.ts         # 图集切割
│   └── json-to-plist-converter.ts  # 格式转换
├── static/
│   ├── index.html             # 前端页面
│   ├── style.css              # 样式文件
│   └── app.js                 # 前端逻辑
├── res/                       # 资源存放目录（自动创建）
├── uploads/                   # 临时上传目录（自动创建）
└── output/                    # 处理结果目录（自动创建）
```

## 🎯 功能特性

### 服务器端 (server.ts)

✅ **文件上传**
- 支持拖拽上传文件夹
- 支持拖拽上传 ZIP 文件
- 最大支持 500MB 文件

✅ **ZIP 处理**
- 自动解压 ZIP 文件
- 保存到 `res` 目录
- 自动删除原 ZIP 文件

✅ **文件夹处理**
- 保持原有目录结构
- 批量上传所有文件
- 自动创建目标目录

✅ **任务管理**
- 任务队列系统
- 实时进度追踪
- 状态管理（排队、处理中、完成、失败）

✅ **结果下载**
- 自动打包处理结果
- ZIP 格式下载
- 保持目录结构

### 前端界面 (static/)

✅ **美观界面**
- 现代化设计
- 渐变背景
- 响应式布局

✅ **拖拽上传**
- 拖拽文件夹
- 拖拽 ZIP 文件
- 实时进度显示

✅ **任务管理**
- 任务列表展示
- 实时状态更新
- 进度条显示

✅ **统计信息**
- 排队任务数
- 处理中任务数
- 完成任务数
- 失败任务数

## 🔌 API 接口

### 1. 上传文件
```
POST /api/upload
Content-Type: multipart/form-data

Body:
- files: File[] (文件数组)
- folderName: string (文件夹名称，可选)

Response:
{
  "success": true,
  "taskId": "1234567890",
  "message": "文件已接收，开始处理"
}
```

### 2. 获取任务状态
```
GET /api/task/:taskId

Response:
{
  "success": true,
  "task": {
    "id": "1234567890",
    "name": "my-folder",
    "type": "folder",
    "status": "processing",
    "progress": 75,
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

### 3. 获取所有任务
```
GET /api/tasks

Response:
{
  "success": true,
  "tasks": [...]
}
```

### 4. 下载结果
```
GET /api/download/:taskId

Response: application/zip
```

### 5. 删除任务
```
DELETE /api/task/:taskId

Response:
{
  "success": true,
  "message": "任务已删除"
}
```

### 6. 健康检查
```
GET /api/health

Response:
{
  "success": true,
  "message": "Server is running",
  "uptime": 12345,
  "resDir": "/path/to/res",
  "tasksCount": 5
}
```

## 📝 工作流程

1. **用户上传**
   - 在网页中拖拽文件夹或 ZIP 文件
   - 前端将文件发送到 `/api/upload`

2. **服务器接收**
   - 保存文件到临时 `uploads` 目录
   - 创建任务并加入队列

3. **处理文件**
   - 如果是 ZIP：解压到 `res` 目录，删除原 ZIP
   - 如果是文件夹：移动所有文件到 `res` 目录

4. **资源处理**
   - 调用 `dealRes()` 处理资源
   - 执行图集切割、格式转换等

5. **完成通知**
   - 更新任务状态
   - 前端显示完成提示
   - 用户可以下载结果

## 🛠️ 配置说明

### 端口配置
在 `server.ts` 中修改：
```typescript
const PORT = 3000; // 修改为你需要的端口
```

### 文件大小限制
在 `server.ts` 中修改：
```typescript
limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
}
```

### 目录配置
```typescript
const RES_DIR = path.join(ROOT_DIR, 'res');      // 资源目录
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads'); // 上传临时目录
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');  // 输出目录
```

## 🔧 开发说明

### 添加新的处理逻辑

在 `processTask` 函数中，已经调用了 `dealRes(targetDir)`。

如果需要添加其他处理逻辑，在此处添加：

```typescript
// 在 server.ts 的 processTask 函数中
await dealRes(targetDir);

// 添加其他处理
await yourCustomProcess(targetDir);
```

### 前端自定义

修改 `static/` 目录下的文件：
- `index.html` - 页面结构
- `style.css` - 样式
- `app.js` - 交互逻辑

## 📊 日志输出

服务器会输出详细的处理日志：

```
📤 接收到 15 个文件
⚙️  开始处理任务: my-project
📦 解压 ZIP: my-project.zip
🗑️  已删除原 ZIP 文件
✅ 文件已保存到: /path/to/res/my-project
🔧 开始处理资源...
✅ 任务完成: my-project
```

## ⚠️ 注意事项

1. **文件权限**
   - 确保服务器对 `res`、`uploads`、`output` 目录有读写权限

2. **磁盘空间**
   - 上传大文件需要足够的磁盘空间
   - 定期清理 `uploads` 和 `output` 目录

3. **并发处理**
   - 目前是单任务队列处理
   - 如需并发，修改 `processNextTask` 逻辑

4. **错误处理**
   - 失败的任务会保留在列表中
   - 可以手动删除或重试

## 🐛 故障排除

### 端口被占用
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000

# 或修改 server.ts 中的端口号
```

### 上传失败
- 检查文件大小是否超过限制
- 检查网络连接
- 查看服务器日志

### 处理失败
- 检查 `dealRes.ts` 中的处理逻辑
- 查看服务器控制台的错误信息
- 检查资源文件格式是否正确

## 📄 许可证

MIT
