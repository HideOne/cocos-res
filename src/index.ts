import { sliceAtlas } from "./slice-atlas";
import { dealRes } from "./dealRes";
import * as fs from "fs";
import * as path from "path";
import { runAstcToPngWorkflow } from "./astcToPng";
import { ROOT_DIR } from "./config";
// import { convertJSONToPlist } from "./json-to-plist-converter";

async function main() {
    try {
        // 遍历当前项目下的 res 目录并输出文件夹路径
        const resDir = path.join(ROOT_DIR, "res");

        // await runAstcToPngWorkflow(resDir);

        console.log(`扫描目录: ${resDir}`);

        if (fs.existsSync(resDir)) {
            const entries = fs.readdirSync(resDir, { withFileTypes: true });
            const dirs = entries.filter(entry => entry.isDirectory());

            console.log(`找到 ${dirs.length} 个目录\n`);

            for (const entry of dirs) {
                const fullDirPath = path.join(resDir, entry.name);
                console.log(`\n=== 处理目录: ${entry.name} ===`);
                try {
                    await dealRes(fullDirPath);
                } catch (e) {
                    continue;
                }
                console.log(`✓ 完成: ${entry.name}`);
            }

            console.log(`\n=== 所有目录处理完成 ===`);
        } else {
            console.error(`❌ res 目录不存在: ${resDir}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 处理失败:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// 确保异步函数完成后再退出
main()
    .then(() => {
        console.log('\n程序执行完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n程序执行出错:', error);
        process.exit(1);
    });

async function test() {
    let resDir = path.join(ROOT_DIR, "res");

    let dealDir = path.join(resDir, "icon-firef");
    await dealRes(dealDir);

}

// test();