/**
 * 快速测试切图功能
 */

import { sliceAtlas } from './slice-atlas';
import * as fs from 'fs';

async function test() {
    console.log('=== Testing Atlas Slicing ===\n');

    const testCases = [
        {
            name: 'Test 1: hetu atlas',
            image: 'D:\\work\\test\\fnt\\assets\\resources\\pic\\hetu.png',
            plist: 'D:\\work\\test\\fnt\\assets\\resources\\pic\\hetu.plist',
            output: undefined // 使用默认输出
        }
    ];

    for (const testCase of testCases) {
        console.log(`Running: ${testCase.name}`);

        // 检查文件是否存在
        if (!fs.existsSync(testCase.image)) {
            console.log(`⚠ Skipped: Image not found - ${testCase.image}`);
            console.log('');
            continue;
        }

        if (!fs.existsSync(testCase.plist)) {
            console.log(`⚠ Skipped: Plist not found - ${testCase.plist}`);
            console.log('');
            continue;
        }

        try {
            await sliceAtlas(testCase.image, testCase.plist, testCase.output);
            console.log('✓ Test passed!\n');
        } catch (error) {
            console.error('✗ Test failed:', error instanceof Error ? error.message : error);
            console.log('');
        }
    }

    console.log('=== All Tests Complete ===');
}

test();
