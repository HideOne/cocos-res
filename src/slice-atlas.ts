/**
 * 图集切图工具
 * 根据 plist 文件信息将图集切分为单独的图片
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseString } from 'xml2js';
import sharp from 'sharp';

interface FrameInfo {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    originalWidth: number;
    originalHeight: number;
    rotated: boolean;
}

/**
 * 解析坐标字符串 "{x,y}" 或 "{{x,y},{w,h}}"
 */
function parseCoordinates(str: string): number[] {
    const matches = str.match(/-?\d+/g);
    return matches ? matches.map(Number) : [];
}

/**
 * 解析 plist 文件
 */
async function parsePlist(plistPath: string): Promise<FrameInfo[]> {
    const xmlContent = fs.readFileSync(plistPath, 'utf8');

    return new Promise((resolve, reject) => {
        parseString(xmlContent, (err: Error | null, result: any) => {
            if (err) {
                reject(err);
                return;
            }

            const frames: FrameInfo[] = [];
            const framesDict = result.plist.dict[0].dict[0];

            // 遍历 frames 字典
            const keys = framesDict.key || [];
            const dicts = framesDict.dict || [];

            for (let i = 0; i < keys.length; i++) {
                const frameName = keys[i].replace('.png', ''); // 移除 .png 后缀
                const frameDict = dicts[i];

                // 解析帧信息 - XML 解析后，key 和 value 在不同数组中
                const frameKeys = frameDict.key || [];
                const frameStrings = frameDict.string || [];

                // 构建 key-value 映射
                const valueMap: { [key: string]: string } = {};
                let stringIndex = 0;

                for (const key of frameKeys) {
                    if (key === 'aliases') {
                        // aliases 对应 array，跳过
                        continue;
                    } else if (key === 'textureRotated') {
                        // textureRotated 对应 true/false，跳过
                        continue;
                    } else {
                        // 其他的都对应 string 值
                        if (stringIndex < frameStrings.length) {
                            valueMap[key] = frameStrings[stringIndex];
                            stringIndex++;
                        }
                    }
                }

                const textureRect = valueMap['textureRect'] || '';
                const spriteOffset = valueMap['spriteOffset'] || '';
                const spriteSize = valueMap['spriteSize'] || '';
                const spriteSourceSize = valueMap['spriteSourceSize'] || '';
                const rotated = !!(frameDict.true && frameDict.true.length > 0);

                // 解析坐标
                const rectCoords = parseCoordinates(textureRect); // [x, y, width, height]
                const offsetCoords = parseCoordinates(spriteOffset); // [offsetX, offsetY]
                const sizeCoords = parseCoordinates(spriteSourceSize); // [originalWidth, originalHeight]

                if (rectCoords.length >= 4 && rectCoords[2] > 0 && rectCoords[3] > 0) {
                    frames.push({
                        name: frameName,
                        x: rectCoords[0] || 0,
                        y: rectCoords[1] || 0,
                        width: rectCoords[2] || 0,
                        height: rectCoords[3] || 0,
                        offsetX: offsetCoords[0] || 0,
                        offsetY: offsetCoords[1] || 0,
                        originalWidth: sizeCoords[0] || rectCoords[2] || 0,
                        originalHeight: sizeCoords[1] || rectCoords[3] || 0,
                        rotated: rotated
                    });
                }
            }

            resolve(frames);
        });
    });
}

/**
 * 切割图集
 * @param imagePath 图集图片路径
 * @param plistPath plist 文件路径
 * @param outputDir 输出目录（可选，默认为图片同名目录）
 */
export async function sliceAtlas(
    imagePath: string,
    plistPath: string,
    outputDir?: string
): Promise<void> {
    console.log(imagePath, plistPath);
    // return
    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
    }

    if (!fs.existsSync(plistPath)) {
        throw new Error(`Plist file not found: ${plistPath}`);
    }

    // 确定输出目录
    if (!outputDir) {
        const imageDir = path.dirname(imagePath);
        const imageBaseName = path.basename(imagePath, path.extname(imagePath));
        outputDir = path.join(imageDir, imageBaseName);
    }

    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`\n📖 Reading plist: ${path.basename(plistPath)}`);
    const frames = await parsePlist(plistPath);
    console.log(`   Found ${frames.length} frames`);

    console.log(`\n🖼️  Loading image: ${path.basename(imagePath)}`);
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    console.log(`   Image size: ${metadata.width}x${metadata.height}`);
    console.log(`   Output: ${outputDir}`);
    console.log(`\n✂️  Slicing...`);

    let successCount = 0;
    let errorCount = 0;

    // 切割每个帧
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const progress = `[${i + 1}/${frames.length}]`;

        try {
            const outputPath = path.join(outputDir, `${frame.name}.png`);

            if (frame.rotated) {
                // 处理旋转的帧
                // TexturePacker 将图片顺时针旋转 90 度后放入图集
                // plist 中 textureRect 的宽高是原始尺寸
                // 但在图集中实际占用的是宽高交换后的区域
                await image
                    .clone()
                    .extract({
                        left: frame.x,
                        top: frame.y,
                        width: frame.height,  // 注意：这里要交换宽高
                        height: frame.width   // 因为在图集中已经旋转了
                    })
                    .rotate(270) // 逆时针旋转 90 度恢复原始方向
                    .toFile(outputPath);

                console.log(`   ${progress} ✓ ${frame.name}.png (rotated ${frame.width}x${frame.height})`);
            } else {
                // 普通帧
                await image
                    .clone()
                    .extract({
                        left: frame.x,
                        top: frame.y,
                        width: frame.width,
                        height: frame.height
                    })
                    .toFile(outputPath);

                console.log(`   ${progress} ✓ ${frame.name}.png (${frame.width}x${frame.height})`);
            }

            successCount++;
        } catch (error) {
            console.error(`   ${progress} ✗ ${frame.name}:`, error instanceof Error ? error.message : error);
            errorCount++;
        }
    }

    console.log(`\n✅ Slicing Complete`);
    console.log(`   Success: ${successCount}/${frames.length}`);
    if (errorCount > 0) {
        console.log(`   ❌ Errors: ${errorCount}`);
    }
    console.log(`   📁 Output: ${outputDir}`);
}

/**
 * 批量切割目录下的所有图集
 * @param dirPath 包含图片和 plist 文件的目录
 */
export async function sliceAtlasDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath);
    const plistFiles = files.filter(f => f.endsWith('.plist'));

    console.log(`\n📂 Scanning directory: ${dirPath}`);
    console.log(`   Found ${plistFiles.length} plist files\n`);

    let processedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < plistFiles.length; i++) {
        const plistFile = plistFiles[i];
        const plistPath = path.join(dirPath, plistFile);
        const baseName = path.basename(plistFile, '.plist');

        console.log(`\n[${i + 1}/${plistFiles.length}] Processing: ${plistFile}`);

        // 查找对应的图片文件
        const possibleImageExts = ['.png', '.jpg', '.jpeg', '.webp'];
        let imagePath = '';

        for (const ext of possibleImageExts) {
            const testPath = path.join(dirPath, baseName + ext);
            if (fs.existsSync(testPath)) {
                imagePath = testPath;
                break;
            }
        }

        if (!imagePath) {
            console.log(`   ⚠️  Skipped: No image file found`);
            errorCount++;
            continue;
        }

        try {
            await sliceAtlas(imagePath, plistPath);
            processedCount++;
        } catch (error) {
            console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
            errorCount++;
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Batch processing complete`);
    console.log(`   Processed: ${processedCount}/${plistFiles.length}`);
    if (errorCount > 0) {
        console.log(`   ❌ Errors: ${errorCount}`);
    }
}

// 命令行接口
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage:');
        console.log('  Slice single atlas:');
        console.log('    ts-node slice-atlas.ts <image-path> <plist-path> [output-dir]');
        console.log('');
        console.log('  Slice all atlases in directory:');
        console.log('    ts-node slice-atlas.ts <directory> --batch');
        console.log('');
        console.log('Examples:');
        console.log('  ts-node slice-atlas.ts hetu.png hetu.plist');
        console.log('  ts-node slice-atlas.ts hetu.png hetu.plist ./output');
        console.log('  ts-node slice-atlas.ts ./atlas-dir --batch');
        process.exit(1);
    }

    const run = async () => {
        try {
            if (args.includes('--batch')) {
                // 批量处理模式
                const dirPath = args[0];
                await sliceAtlasDirectory(dirPath);
            } else {
                // 单个图集处理模式
                const imagePath = args[0];
                const plistPath = args[1];
                const outputDir = args[2];

                if (!plistPath) {
                    console.error('Error: plist-path is required');
                    process.exit(1);
                }

                await sliceAtlas(imagePath, plistPath, outputDir);
            }
        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    };

    run();
}
