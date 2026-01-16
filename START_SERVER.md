# 快速启动指南

## 🚀 立即开始

### 1. 安装依赖（首次运行）

```bash
npm install
```

需要安装的主要依赖：
- `express` - Web 服务器
- `multer` - 文件上传处理
- `adm-zip` - ZIP 文件处理
- `sharp` - 图片处理
- `xml2js` - XML 解析

### 2. 启动服务器

**方式一：开发模式（推荐）**
```bash
npm run server:dev
```
特点：代码修改后自动重启

**方式二：直接运行**
```bash
npm run server
```

**方式三：编译后运行**
```bash
npm run build
npm start
```

### 3. 打开网页

浏览器访问：
```
http://localhost:3000
```

## 📋 使用流程

### 上传文件夹

1. 拖拽文件夹到上传区域
2. 或点击"选择文件夹"按钮
3. 等待上传和处理完成
4. 点击"下载结果"获取处理后的文件

### 上传 ZIP

1. 拖拽 ZIP 文件到上传区域
2. 或点击"选择 ZIP"按钮
3. 服务器会自动解压并处理
4. 原 ZIP 文件会被自动删除
5. 处理完成后可下载结果

## 🎯 服务器功能

### 自动处理流程

```
上传 → 保存到 res/ → 处理资源 → 生成结果 → 下载
```

1. **ZIP 文件**
   - 解压到 `res/` 目录
   - 删除原 ZIP
   - 保持目录结构

2. **文件夹**
   - 复制所有文件到 `res/`
   - 保持原有结构

3. **资源处理**
   - 调用 `dealRes()` 处理
   - 图集切割
   - 格式转换

4. **结果下载**
   - 打包成 ZIP
   - 包含所有处理结果

## 📁 目录说明

运行后自动创建：

```
cocosRes/
├── res/          # 资源存放（上传的文件）
├── uploads/      # 临时上传目录
└── output/       # 处理结果输出
```

## 🔍 查看日志

服务器会输出详细日志：

```bash
🚀 Cocos 资源处理服务器已启动
📡 服务地址: http://localhost:3000
📁 资源目录: D:\suyu\cocosRes\res
📤 上传目录: D:\suyu\cocosRes\uploads
📦 输出目录: D:\suyu\cocosRes\output
```

处理时会显示：
```
📤 接收到 15 个文件
⚙️  开始处理任务: my-project
📦 解压 ZIP: my-project.zip
🗑️  已删除原 ZIP 文件
✅ 文件已保存到: /path/to/res/my-project
🔧 开始处理资源...
✅ 任务完成: my-project
```

## 💡 快速测试

### 测试上传功能

1. 准备一个测试文件夹或 ZIP
2. 访问 http://localhost:3000
3. 拖拽文件到网页
4. 观察控制台日志和网页进度

### 测试 API

```bash
# 健康检查
curl http://localhost:3000/api/health

# 查看所有任务
curl http://localhost:3000/api/tasks
```

## ⚙️ 常见问题

### Q: 如何修改端口？

编辑 `src/server.ts`：
```typescript
const PORT = 3000; // 改为你需要的端口
```

### Q: 上传文件大小限制？

默认 500MB，修改 `src/server.ts`：
```typescript
limits: {
    fileSize: 500 * 1024 * 1024 // 修改这里
}
```

### Q: 如何停止服务器？

按 `Ctrl + C` 优雅关闭

### Q: 如何清理文件？

```bash
# 手动删除
rm -rf res/* uploads/* output/*

# 或在 Windows
del /s /q res\* uploads\* output\*
```

## 📝 下一步

1. ✅ 服务器已配置完成
2. ✅ 前端已连接到服务器
3. ✅ 支持文件夹和 ZIP 上传
4. ✅ 自动处理资源
5. ✅ 结果下载功能

现在可以开始使用了！🎉

## 🔗 相关文档

- [完整服务器文档](SERVER_README.md)
- [切图工具说明](切图工具说明.md)
- [JSON 转换文档](README-converter.md)
