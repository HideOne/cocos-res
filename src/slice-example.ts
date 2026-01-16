/**
 * 图集切图示例
 */

import { sliceAtlas, sliceAtlasDirectory } from './slice-atlas';
import * as path from 'path';

console.log('=== Atlas Slicing Examples ===\n');

// ============================================
// 示例 1: 切割单个图集
// ============================================
async function example1() {
    console.log('Example 1: Slice single atlas\n');

    const imagePath = 'D:\\work\\test\\fnt\\assets\\resources\\pic\\hetu.png';
    const plistPath = 'D:\\work\\test\\fnt\\assets\\resources\\pic\\hetu.plist';

    try {
        await sliceAtlas(imagePath, plistPath);
        // 输出到 D:\work\test\fnt\assets\resources\pic\hetu\ 目录
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================
// 示例 2: 指定输出目录
// ============================================
async function example2() {
    console.log('Example 2: Slice with custom output directory\n');

    const imagePath = 'D:\\work\\test\\fnt\\assets\\resources\\pic\\hetu.png';
    const plistPath = 'D:\\work\\test\\fnt\\assets\\resources\\pic\\hetu.plist';
    const outputDir = 'D:\\work\\test\\fnt\\assets\\resources\\pic\\sliced-frames';

    try {
        await sliceAtlas(imagePath, plistPath, outputDir);
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================
// 示例 3: 批量切割目录下的所有图集
// ============================================
async function example3() {
    console.log('Example 3: Batch slice all atlases in directory\n');

    const dirPath = 'D:\\work\\test\\fnt\\assets\\resources\\pic';

    try {
        await sliceAtlasDirectory(dirPath);
        // 会自动找到目录下所有的 .plist 文件和对应的图片
        // 为每个图集创建对应的子目录
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================
// 运行示例
// ============================================

const run = async () => {
    const exampleNum = process.argv[2];

    if (exampleNum === '1') {
        await example1();
    } else if (exampleNum === '2') {
        await example2();
    } else if (exampleNum === '3') {
        await example3();
    } else {
        console.log('Available examples:');
        console.log('  1 - Slice single atlas');
        console.log('  2 - Slice with custom output directory');
        console.log('  3 - Batch slice all atlases in directory');
        console.log('\nUsage: ts-node slice-example.ts [1-3]');
    }
};

run();
