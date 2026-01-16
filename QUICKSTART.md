# 快速开始指南

## 立即使用（无需安装依赖）

### JavaScript 版本（推荐快速使用）

```bash
# 转换单个文件
node json-to-plist-converter.js your-file.json

# 转换单个文件并指定输出
node json-to-plist-converter.js your-file.json output.plist

# 批量转换目录
node json-to-plist-converter.js ./input-dir --dir ./output-dir
```

### TypeScript 版本（需要先安装依赖）

```bash
# 安装依赖
npm install

# 转换文件
npm run convert:ts your-file.json

# 或直接使用 ts-node
ts-node json-to-plist-converter.ts your-file.json
```

## 具体示例

### 1. 转换提供的示例文件

```bash
node json-to-plist-converter.js "d:\work\test\fnt\build\web-mobile\assets\resources\import\0f\0faa447ee.json" "d:\work\test\fnt\assets\resources\pic\hetu.plist"
```

### 2. 批量转换 activity-album 目录

```bash
node json-to-plist-converter.js "d:\suyu\cocosRes\activity-album\import\01" --dir "d:\suyu\cocosRes\activity-album\output"
```

### 3. 在代码中使用

创建一个新文件 `my-converter.js`：

```javascript
const converter = require('./json-to-plist-converter');

// 转换文件
converter.convertJSONToPlist(
    'd:\\work\\test\\fnt\\build\\web-mobile\\assets\\resources\\import\\0f\\0faa447ee.json',
    'd:\\work\\test\\fnt\\assets\\resources\\pic\\hetu.plist'
);

console.log('Done!');
```

运行：

```bash
node my-converter.js
```

## 运行示例代码

```bash
# 查看所有示例
node example-usage.js

# 运行特定示例
node example-usage.js 1  # 基础转换
node example-usage.js 3  # 仅解析数据
node example-usage.js 4  # 批量转换
```

## 作为 npm 包使用

如果你想在其他项目中使用：

```bash
# 全局安装（可选）
npm install -g .

# 然后可以在任何地方使用
cocos-to-plist your-file.json
```

## 常见用法

### 场景 1: 游戏资源导出后处理

```bash
# 假设你的 Cocos Creator 项目构建输出在 build/web-mobile
# 找到所有图集 JSON 文件并转换

# Windows
node json-to-plist-converter.js "d:\my-game\build\web-mobile\assets\resources\import" --dir "d:\my-game\plist-output"

# macOS/Linux
node json-to-plist-converter.js ~/my-game/build/web-mobile/assets/resources/import --dir ~/my-game/plist-output
```

### 场景 2: 集成到构建流程

在你的构建脚本中添加：

```javascript
// build.js
const converter = require('./json-to-plist-converter');
const path = require('path');

// 构建完成后自动转换
function postBuild() {
    const buildDir = path.join(__dirname, 'build/web-mobile/assets/resources/import');
    const outputDir = path.join(__dirname, 'plist-export');
    
    console.log('Converting atlas files to plist...');
    converter.convertDirectory(buildDir, outputDir);
    console.log('Conversion complete!');
}

postBuild();
```

### 场景 3: 选择性转换

```javascript
const converter = require('./json-to-plist-converter');
const fs = require('fs');
const path = require('path');

// 只转换包含特定内容的文件
const inputDir = 'd:\\suyu\\cocosRes\\activity-album\\import\\01';
const outputDir = 'd:\\suyu\\cocosRes\\activity-album\\output';

const files = fs.readdirSync(inputDir);
files.forEach(file => {
    if (file.endsWith('.json')) {
        const filePath = path.join(inputDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 检查是否包含图集数据
        if (content.includes('SpriteAtlas') || content.includes('cc.SpriteFrame')) {
            console.log(`Converting ${file}...`);
            const outputPath = path.join(outputDir, file.replace('.json', '.plist'));
            converter.convertJSONToPlist(filePath, outputPath);
        }
    }
});
```

## 验证转换结果

转换完成后，你可以：

1. 在文本编辑器中打开生成的 `.plist` 文件查看
2. 使用 plist 查看工具验证格式
3. 在支持 plist 的工具中导入测试（如 Texture Packer Viewer）

## 故障排除

### 问题：找不到文件

确保路径正确，Windows 路径需要使用双反斜杠或正斜杠：

```javascript
// 正确
"d:\\path\\to\\file.json"
"d:/path/to/file.json"

// 错误
"d:\path\to\file.json"
```

### 问题：转换失败

检查 JSON 文件是否是有效的 Cocos Creator 图集文件：

```bash
node example-usage.js 3  # 运行示例 3 仅解析数据，不生成文件
```

### 问题：批量转换时部分文件失败

这是正常的，因为 import 目录可能包含非图集文件。查看控制台输出了解哪些文件成功转换。

## 下一步

- 查看 `README-converter.md` 了解完整文档
- 查看 `example-usage.js` 了解更多使用方式
- 修改脚本以适应你的特定需求

## 技术支持

如有问题，请检查：
1. Node.js 版本 >= 14.0.0
2. 输入文件是有效的 JSON 格式
3. 输出目录有写入权限
