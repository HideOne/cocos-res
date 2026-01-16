/**
 * 图集工具集合
 * 整合 JSON 转 plist 和图集切图功能
 */

import { convertJSONToPlist, convertDirectory } from './json-to-plist-converter';
import { sliceAtlas, sliceAtlasDirectory } from './slice-atlas';
import * as fs from 'fs';
import * as path from 'path';

interface ToolOptions {
    command: 'convert' | 'slice' | 'batch-convert' | 'batch-slice' | 'full';
    inputPath: string;
    outputPath?: string;
    plistPath?: string;
}

/**
 * 完整流程：JSON -> plist -> 切图
 */
async function fullProcess(jsonPath: string, imagePath: string, outputDir?: string): Promise<void> {
    console.log('=== Full Process: JSON to Sliced Images ===\n');

    // 步骤 1: 生成 plist
    console.log('Step 1: Converting JSON to plist...');
    const plistPath = jsonPath.replace('.json', '.plist');
    convertJSONToPlist(jsonPath, plistPath);
    console.log(`✓ Generated: ${plistPath}\n`);

    // 步骤 2: 切图
    console.log('Step 2: Slicing atlas...');
    await sliceAtlas(imagePath, plistPath, outputDir);
    console.log('\n✓ Full process complete!');
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
    console.log(`
Atlas Tools - Cocos Creator 图集工具集

Usage:
  ts-node atlas-tools.ts <command> [options]

Commands:
  convert <json> [plist]           将 JSON 转换为 plist
  slice <image> <plist> [output]   切割图集
  batch-convert <dir> [output]     批量转换目录下的 JSON
  batch-slice <dir>                批量切割目录下的图集
  full <json> <image> [output]     完整流程：JSON -> plist -> 切图

Examples:
  # 转换 JSON 到 plist
  ts-node atlas-tools.ts convert input.json output.plist

  # 切割图集
  ts-node atlas-tools.ts slice atlas.png atlas.plist

  # 批量转换
  ts-node atlas-tools.ts batch-convert ./import ./output

  # 批量切图
  ts-node atlas-tools.ts batch-slice ./textures

  # 完整流程
  ts-node atlas-tools.ts full 0faa447ee.json hetu.png ./output

Options:
  -h, --help     显示帮助信息
  -v, --version  显示版本信息
`);
}

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        showHelp();
        return;
    }

    if (args.includes('-v') || args.includes('--version')) {
        console.log('Atlas Tools v1.0.0');
        return;
    }

    const command = args[0];

    try {
        switch (command) {
            case 'convert': {
                const jsonPath = args[1];
                const plistPath = args[2];

                if (!jsonPath) {
                    console.error('Error: JSON path is required');
                    process.exit(1);
                }

                console.log('Converting JSON to plist...');
                convertJSONToPlist(jsonPath, plistPath);
                break;
            }

            case 'slice': {
                const imagePath = args[1];
                const plistPath = args[2];
                const outputDir = args[3];

                if (!imagePath || !plistPath) {
                    console.error('Error: Image path and plist path are required');
                    process.exit(1);
                }

                console.log('Slicing atlas...');
                await sliceAtlas(imagePath, plistPath, outputDir);
                break;
            }

            case 'batch-convert': {
                const inputDir = args[1];
                const outputDir = args[2];

                if (!inputDir) {
                    console.error('Error: Input directory is required');
                    process.exit(1);
                }

                console.log('Batch converting...');
                convertDirectory(inputDir, outputDir);
                break;
            }

            case 'batch-slice': {
                const dirPath = args[1];

                if (!dirPath) {
                    console.error('Error: Directory path is required');
                    process.exit(1);
                }

                console.log('Batch slicing...');
                await sliceAtlasDirectory(dirPath);
                break;
            }

            case 'full': {
                const jsonPath = args[1];
                const imagePath = args[2];
                const outputDir = args[3];

                if (!jsonPath || !imagePath) {
                    console.error('Error: JSON path and image path are required');
                    process.exit(1);
                }

                await fullProcess(jsonPath, imagePath, outputDir);
                break;
            }

            default:
                console.error(`Error: Unknown command '${command}'`);
                console.log('Run with -h or --help for usage information');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

export { fullProcess };
