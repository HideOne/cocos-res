# Cocos Creator JSON to Plist Converter

将 Cocos Creator 编译后的 JSON 图集文件转换为标准的 plist 格式。

## 功能特性

- ✅ 支持单文件转换
- ✅ 支持批量目录转换
- ✅ 自动解析 Cocos Creator JSON 格式
- ✅ 生成标准 plist XML 格式
- ✅ 可作为命令行工具或 Node.js 模块使用

## 安装依赖

无需额外依赖，仅使用 Node.js 内置模块。

## 使用方法

### 1. 命令行方式

#### 转换单个文件

```bash
# 自动生成同名 plist 文件
node json-to-plist-converter.js 0faa447ee.json

# 指定输出文件名
node json-to-plist-converter.js 0faa447ee.json hetu.plist
```

#### 批量转换目录

```bash
# 在原目录生成 plist 文件
node json-to-plist-converter.js ./import --dir

# 指定输出目录
node json-to-plist-converter.js ./import --dir ./output
```

### 2. 作为模块使用

```javascript
const converter = require('./json-to-plist-converter');

// 转换单个文件
converter.convertJSONToPlist(
    'path/to/input.json',
    'path/to/output.plist'
);

// 批量转换目录
converter.convertDirectory(
    'path/to/input-dir',
    'path/to/output-dir'
);

// 仅解析 JSON（不生成文件）
const jsonData = require('./input.json');
const atlasData = converter.parseCreatorJSON(jsonData);
console.log(atlasData);

// 仅生成 plist 字符串
const plistXML = converter.generatePlist(atlasData);
console.log(plistXML);
```

## 输入格式

输入的 JSON 文件应该是 Cocos Creator 编译后的图集文件格式，结构如下：

```json
[
    1,
    ["uuid1", "uuid2", ...],
    ["_textureSetter", "sprite1", "sprite2", ...],
    [类型定义],
    [数据引用],
    [
        [帧数据1],
        [图集信息],
        [帧数据2],
        ...
    ]
]
```

## 输出格式

输出的 plist 文件为标准的 Apple Property List 格式，包含：

- `frames`: 所有精灵帧的信息（位置、大小、偏移等）
- `metadata`: 图集元数据（格式、纹理文件名、尺寸等）

## API 文档

### `convertJSONToPlist(jsonFilePath, outputPath)`

转换单个 JSON 文件到 plist 格式。

**参数：**
- `jsonFilePath` (string): 输入的 JSON 文件路径
- `outputPath` (string, 可选): 输出的 plist 文件路径，默认为同目录同名

**返回值：** 
- (string): 输出文件的路径

### `convertDirectory(dirPath, outputDir)`

批量转换目录下的所有 JSON 文件。

**参数：**
- `dirPath` (string): 输入目录路径
- `outputDir` (string, 可选): 输出目录路径，默认为输入目录

**返回值：**
- (Array): 转换结果数组，每个元素包含 `{success, file, output/error}`

### `parseCreatorJSON(jsonData)`

解析 Cocos Creator JSON 格式数据。

**参数：**
- `jsonData` (Array): JSON 数组数据

**返回值：**
- (Object): 包含 `{atlasName, textureFileName, frames, size}` 的图集信息对象

### `generatePlist(atlasData)`

从图集数据生成 plist XML 字符串。

**参数：**
- `atlasData` (Object): 由 `parseCreatorJSON` 返回的图集数据

**返回值：**
- (string): plist XML 字符串

## 示例

### 示例 1: 简单转换

```bash
node json-to-plist-converter.js d:\work\test\fnt\build\web-mobile\assets\resources\import\0f\0faa447ee.json
```

输出：
```
Reading JSON file: d:\work\test\fnt\build\web-mobile\assets\resources\import\0f\0faa447ee.json
Parsing Cocos Creator JSON format...
Generating plist XML...
✓ Successfully converted to: d:\work\test\fnt\build\web-mobile\assets\resources\import\0f\0faa447ee.plist
  Found 5 frames
  Texture: hetu.png
  Size: 319x131
```

### 示例 2: 批量转换

```bash
node json-to-plist-converter.js d:\suyu\cocosRes\activity-album\import --dir d:\suyu\cocosRes\activity-album\output
```

### 示例 3: 在代码中使用

```javascript
const converter = require('./json-to-plist-converter');
const path = require('path');

// 转换特定文件
const inputFile = path.join(__dirname, 'import', '0f', '0faa447ee.json');
const outputFile = path.join(__dirname, 'output', 'hetu.plist');

try {
    converter.convertJSONToPlist(inputFile, outputFile);
    console.log('Conversion successful!');
} catch (error) {
    console.error('Conversion failed:', error.message);
}
```

## 注意事项

1. 确保输入文件是有效的 Cocos Creator JSON 格式
2. 输出目录会自动创建（如果不存在）
3. 如果输出文件已存在，会被覆盖
4. 帧名称会自动添加 `.png` 后缀

## 故障排除

**Q: 转换失败，提示 "Unexpected token"**  
A: 检查 JSON 文件格式是否正确，确保是有效的 JSON 数组

**Q: 生成的 plist 没有帧信息**  
A: 检查输入的 JSON 文件是否包含图集数据，可能是其他类型的资源文件

**Q: 批量转换时部分文件失败**  
A: 查看控制台输出，会显示具体哪些文件失败及原因

## 许可证

MIT
