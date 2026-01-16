/**
 * Cocos Creator JSON to Plist Converter (TypeScript Version)
 * 将 Cocos Creator 编译后的 JSON 图集文件转换为标准的 plist 格式
 */

import * as fs from 'fs';
import * as path from 'path';

interface FrameData {
    name?: string;
    rect?: number[];
    offset?: number[];
    originalSize?: number[];
    rotated?: boolean;
}

interface Frame {
    rect: number[];
    offset: number[];
    originalSize: number[];
    rotated: boolean;
}

interface AtlasData {
    atlasName: string;
    textureFileName: string;
    frames: Record<string, Frame>;
    size: number[];
}

interface ConversionResult {
    success: boolean;
    file: string;
    output?: string;
    error?: string;
}

/**
 * 解析 Cocos Creator JSON 格式
 */
function parseCreatorJSON(jsonData: any[]): AtlasData {
    // JSON 结构说明:
    // [0] - 版本号
    // [1] - 依赖/引用列表
    // [2] - 名称列表
    // [3] - 类型定义
    // [4] - 数据引用
    // [5] - 实际数据

    const actualData = jsonData[5]; // 获取实际数据

    const frames: Record<string, Frame> = {};
    let atlasName = 'atlas.plist';
    let textureFileName = 'atlas.png';
    let maxWidth = 0;
    let maxHeight = 0;

    // 遍历数据，找到图集名称和帧信息
    actualData.forEach((item: any, index: number) => {
        if (!Array.isArray(item) || item.length === 0) {
            return;
        }

        const firstElement = item[0];

        // 检查是否是包含 SpriteAtlas 信息的数组
        if (Array.isArray(firstElement) && firstElement.length > 0) {
            const innerArray = firstElement[0];

            // 检查是否是 SpriteAtlas 定义 [0, "xxx.plist", [...]]
            if (Array.isArray(innerArray) && innerArray.length >= 2 && typeof innerArray[1] === 'string' && innerArray[1].includes('.plist')) {
                atlasName = innerArray[1];
                textureFileName = atlasName.replace('.plist', '.png');
            }
            // 检查是否是帧数据对象
            else if (typeof innerArray === 'object' && innerArray !== null && innerArray.name) {
                const frame = innerArray as FrameData;
                const frameName = frame.name!;

                frames[frameName] = {
                    rect: frame.rect || [0, 0, 0, 0],
                    offset: frame.offset || [0, 0],
                    originalSize: frame.originalSize || [0, 0],
                    rotated: frame.rotated || false
                };

                // 计算纹理大小
                const [x, y, w, h] = frame.rect || [0, 0, 0, 0];
                maxWidth = Math.max(maxWidth, x + w);
                maxHeight = Math.max(maxHeight, y + h);
            }
        }
        // 检查第一层是否直接是帧数据对象
        else if (typeof firstElement === 'object' && firstElement !== null && firstElement.name) {
            const frame = firstElement as FrameData;
            const frameName = frame.name!;

            frames[frameName] = {
                rect: frame.rect || [0, 0, 0, 0],
                offset: frame.offset || [0, 0],
                originalSize: frame.originalSize || [0, 0],
                rotated: frame.rotated || false
            };

            // 计算纹理大小
            const [x, y, w, h] = frame.rect || [0, 0, 0, 0];
            maxWidth = Math.max(maxWidth, x + w);
            maxHeight = Math.max(maxHeight, y + h);
        }
    });

    return {
        atlasName,
        textureFileName,
        frames,
        size: [maxWidth, maxHeight]
    };
}

/**
 * 生成 plist XML 格式
 */
function generatePlist(atlasData: AtlasData): string {
    const { textureFileName, frames, size } = atlasData;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n';
    xml += '<plist version="1.0">\n';
    xml += '    <dict>\n';
    xml += '        <key>frames</key>\n';
    xml += '        <dict>\n';

    // 添加每个帧
    Object.keys(frames).sort().forEach(frameName => {
        const frame = frames[frameName];
        const [x, y, width, height] = frame.rect;
        const [offsetX, offsetY] = frame.offset;
        const [origWidth, origHeight] = frame.originalSize;

        xml += `            <key>${frameName}.png</key>\n`;
        xml += '            <dict>\n';
        xml += '                <key>aliases</key>\n';
        xml += '                <array/>\n';
        xml += '                <key>spriteOffset</key>\n';
        xml += `                <string>{${offsetX},${offsetY}}</string>\n`;
        xml += '                <key>spriteSize</key>\n';
        xml += `                <string>{${origWidth},${origHeight}}</string>\n`;
        xml += '                <key>spriteSourceSize</key>\n';
        xml += `                <string>{${origWidth},${origHeight}}</string>\n`;
        xml += '                <key>textureRect</key>\n';
        xml += `                <string>{{${x},${y}},{${width},${height}}}</string>\n`;
        xml += '                <key>textureRotated</key>\n';
        xml += `                <${frame.rotated ? 'true' : 'false'}/>\n`;
        xml += '            </dict>\n';
    });

    xml += '        </dict>\n';
    xml += '        <key>metadata</key>\n';
    xml += '        <dict>\n';
    xml += '            <key>format</key>\n';
    xml += '            <integer>3</integer>\n';
    xml += '            <key>pixelFormat</key>\n';
    xml += '            <string>RGBA8888</string>\n';
    xml += '            <key>premultiplyAlpha</key>\n';
    xml += '            <false/>\n';
    xml += '            <key>realTextureFileName</key>\n';
    xml += `            <string>${textureFileName}</string>\n`;
    xml += '            <key>size</key>\n';
    xml += `            <string>{${size[0]},${size[1]}}</string>\n`;
    xml += '            <key>smartupdate</key>\n';
    xml += '            <string>$TexturePacker:SmartUpdate:generated$</string>\n';
    xml += '            <key>textureFileName</key>\n';
    xml += `            <string>${textureFileName}</string>\n`;
    xml += '        </dict>\n';
    xml += '    </dict>\n';
    xml += '</plist>\n';

    return xml;
}

/**
 * 转换单个 JSON 文件到 plist
 */
function convertJSONToPlist(jsonFilePath: string, outputPath: string | null = null): string {
    try {
        // 读取 JSON 文件
        //console.log(`Reading JSON file: ${jsonFilePath}`);
        const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(jsonContent);

        // 解析 JSON 数据
        //console.log('Parsing Cocos Creator JSON format...');
        const atlasData = parseCreatorJSON(jsonData);

        // 生成 plist
        //console.log('Generating plist XML...');
        const plistContent = generatePlist(atlasData);

        // 确定输出路径
        if (!outputPath) {
            const dir = path.dirname(jsonFilePath);
            const baseName = path.basename(jsonFilePath, '.json');
            outputPath = path.join(dir, `${baseName}.plist`);
        }

        // 写入文件
        fs.writeFileSync(outputPath, plistContent, 'utf8');
        //console.log(`✓ Successfully converted to: ${outputPath}`);
        //console.log(`  Found ${Object.keys(atlasData.frames).length} frames`);
        //console.log(`  Texture: ${atlasData.textureFileName}`);
        //console.log(`  Size: ${atlasData.size[0]}x${atlasData.size[1]}`);

        return outputPath;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        //console.error(`✗ Error converting file: ${message}`);
        throw error;
    }
}

/**
 * 批量转换目录下的所有 JSON 文件
 */
function convertDirectory(dirPath: string, outputDir: string | null = null): ConversionResult[] {
    if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    //console.log(`Found ${jsonFiles.length} JSON files in ${dirPath}`);

    const results: ConversionResult[] = [];
    jsonFiles.forEach(file => {
        const jsonPath = path.join(dirPath, file);
        let outputPath: string | null = null;

        if (outputDir) {
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const baseName = path.basename(file, '.json');
            outputPath = path.join(outputDir, `${baseName}.plist`);
        }

        try {
            const result = convertJSONToPlist(jsonPath, outputPath);
            results.push({ success: true, file, output: result });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            results.push({ success: false, file, error: message });
        }
    });

    // 输出统计
    //const successCount = results.filter(r => r.success).length;
    //console.log(`\n=== Conversion Complete ===`);
    //console.log(`Success: ${successCount}/${jsonFiles.length}`);

    return results;
}

// 命令行接口
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        //console.log('Usage:');
        //console.log('  Convert single file:');
        //console.log('    ts-node json-to-plist-converter.ts <input.json> [output.plist]');
        //console.log('');
        //console.log('  Convert directory:');
        //console.log('    ts-node json-to-plist-converter.ts <input-dir> --dir [output-dir]');
        //console.log('');
        //console.log('Examples:');
        //console.log('  ts-node json-to-plist-converter.ts 0faa447ee.json');
        //console.log('  ts-node json-to-plist-converter.ts 0faa447ee.json hetu.plist');
        //console.log('  ts-node json-to-plist-converter.ts ./import --dir ./output');
        process.exit(1);
    }

    const inputPath = args[0];

    if (args.includes('--dir')) {
        // 批量转换模式
        const outputDir = args[args.indexOf('--dir') + 1] || null;
        convertDirectory(inputPath, outputDir);
    } else {
        // 单文件转换模式
        const outputPath = args[1] || null;
        convertJSONToPlist(inputPath, outputPath);
    }
}

// 导出函数供外部调用
export {
    convertJSONToPlist,
    convertDirectory,
    parseCreatorJSON,
    generatePlist,
    type AtlasData,
    type Frame,
    type FrameData,
    type ConversionResult
};
