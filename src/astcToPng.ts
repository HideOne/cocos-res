import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as util from 'util';
import sharp from 'sharp';

const execPromise = util.promisify(exec);

// 1. 优先查找当前脚本目录下的 astcenc.exe
// 2. 如果没有，则尝试直接使用 'astcenc' 命令（依赖系统 PATH）
const ROOT_DIR = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const localAstcPath: string = isWin
    ? path.join(ROOT_DIR, 'astcenc-avx2.exe')
    : path.join(ROOT_DIR, 'astcenc-avx2');
const ASTCENC_CMD: string = fs.existsSync(localAstcPath) ? `"${localAstcPath}"` : 'astcenc-avx2';

// 获取目标目录，默认为当前目录
const targetDir: string = path.join(ROOT_DIR, 'res');

async function checkAstcencAvailability(): Promise<boolean> {
    try {
        // 尝试运行 help 命令来检查工具是否存在
        console.log('checkAstcencAvailability', ROOT_DIR, `${ASTCENC_CMD} -help`);
        await execPromise(`${ASTCENC_CMD} -help`);
        return true;
    } catch (e: any) {
        // 即使报错，如果输出包含 version 或 help 信息也算成功（有些工具 help 返回非0）
        if (e.stdout && (e.stdout.includes('astcenc') || e.stdout.includes('usage'))) {
            return true;
        }
        return false;
    }
}

async function convertAstcToPng(filePath: string): Promise<void> {
    const outputPngPath = filePath.replace(/\.astc$/i, '.png');
    const outputWebpPath = filePath.replace(/\.astc$/i, '.webp');

    // 第一步：astc -> png
    const commandPng = `${ASTCENC_CMD} -dl "${filePath}" "${outputPngPath}"`;

    try {
        console.log(`正在解码 ASTC: ${path.basename(filePath)} -> ${path.basename(outputPngPath)}`);
        const { stdout: out1, stderr: err1 } = await execPromise(commandPng);

        // astcenc 有时会把警告输出到 stderr，只要不是错误就不管
        if (err1 && !err1.includes('beware') && err1.trim().length > 0) {
            // console.warn(`  警告:`, err1.trim());
        }
        // 直接将 png 文件重命名为 webp 后缀，不做实际格式转换
        try {
            await fs.promises.rename(outputPngPath, outputWebpPath);
            console.log(`  SUCCESS: ${outputWebpPath} (仅重命名，不转换格式)`);
        } catch (errConvert: any) {
            console.error(`  重命名失败: ${outputPngPath} -> ${outputWebpPath}`);
            console.error(`  错误信息: ${errConvert.message || errConvert}`);
        }
    } catch (error: any) {
        console.error(`  FAIL: 转换失败 ${filePath}`);
        console.error(`  错误信息: ${error.message}`);
        // 尝试检测是否是命令未找到
        if (error.message.includes('not found') || error.message.includes('不是内部或外部命令')) {
            console.error('\n!!! 严重错误: 找不到 astcenc 工具 !!!');
        }
    }
}

async function processDirectory(directory: string, processCallback?: (progress: number) => void): Promise<void> {
    try {
        const files = await fs.promises.readdir(directory, { withFileTypes: true });

        // 递归收集所有 .astc 文件
        let astcFiles: string[] = [];
        function collectAstcFiles(dir: string) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            let idx = 0;
            for (const entry of entries) {
                const entryPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    collectAstcFiles(entryPath);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.astc')) {
                    astcFiles.push(entryPath);
                }

                idx++;
            }
        }

        collectAstcFiles(directory);

        const total = astcFiles.length;
        let count = 0;

        for (const file of astcFiles) {
            count++;
            console.log(`[${count}/${total}] 正在处理: ${path.relative(directory, file)}`);
            await convertAstcToPng(file);
            processCallback?.((count / total) * 100);
        }
    } catch (err) {
        console.error(`无法读取目录: ${directory}`, err);
    }
}
export async function runAstcToPngWorkflow(targetDir: string, processCallback?: (progress: number) => void): Promise<void> {
    console.log('================================================');
    console.log(`工作目录: ${targetDir}`);
    console.log(`使用工具: ${ASTCENC_CMD}`);
    console.log('================================================');

    const isAvailable = await checkAstcencAvailability();
    if (!isAvailable) {
        console.error('\n❌ 错误: 未找到 astcenc 工具。');
        console.error('------------------------------------------------');
        console.error('请按照以下步骤修复:');
        console.error('1. 下载 astcenc: https://github.com/ARM-software/astc-encoder/releases');
        console.error('2. 解压并找到 bin/astcenc-sse2.exe');
        console.error(`3. 将其重命名为 astcenc.exe 并放入目录: ${__dirname}`);
        console.error('------------------------------------------------\n');
        process.exit(1);
    }

    await processDirectory(targetDir, processCallback);
    console.log('\n所有任务完成。');
}
