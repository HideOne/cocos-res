import { decompressUuid } from "./tool";
import * as path from "path";
import * as fs from "fs";
import { convertJSONToPlist } from "./json-to-plist-converter";
import { sliceAtlas } from "./slice-atlas";
import { ROOT_DIR } from "./config";

export async function dealRes(dirpath: string, outDir?: string, processCallback?: (progress: number) => void) {

    const configPath = path.join(dirpath, 'config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`config.json not found in path: ${dirpath}`);
    }
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // 获取dirpath最后一级目录名
    const lastDirName = path.basename(dirpath);



    let outPath = outDir;
    if (!outPath) {
        outPath = path.join(ROOT_DIR, 'out', lastDirName);
    }
    if (!fs.existsSync(outPath)) {
        fs.mkdirSync(outPath, { recursive: true });
    }

    let paths = config.paths;
    let uuids = config.uuids;
    let types = config.types;
    let packs = config.packs;

    let improtPath = path.join(dirpath, 'import');
    let nativePath = path.join(dirpath, 'native');
    if (!fs.existsSync(improtPath)) {
        throw new Error(`import 目录不存在: ${improtPath}`);
    }
    if (!fs.existsSync(nativePath)) {
        throw new Error(`native 目录不存在: ${nativePath}`);
    }


    // 子图uuid对应
    let spriteAtlasMap: Map<string, string> = new Map();

    let dealTaskList: (() => void)[] = [];

    for (const key in paths) {
        let [filePath, type] = paths[key];
        let idx = Number(key);

        let compressUuid: string = uuids[idx];
        let decompressedUuid: string = decompressUuid(compressUuid);

        let top = decompressedUuid.slice(0, 2);

        let ext = ""
        let typeName = types[type];

        // if (types[type] === "cc.Texture2D") {
        //     ext = ".png";
        // }

        let realPath = path.join(improtPath, top, decompressedUuid);
        ext = findExt(realPath);
        if (ext && (ext === ".atlas" || typeName !== "cc.Asset")) {
            ext = ext.replace(".astc", ".webp");

            // import下
            realPath += ext;

            if (fs.existsSync(realPath)) {
                let outFilePath = path.join(outPath, `${filePath}${ext}`);
                // console.log("copy file: " + realPath + " to " + outFilePath);
                if (!fs.existsSync(outFilePath)) {
                    fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
                }
                fs.copyFileSync(realPath, outFilePath);

                if (typeName === "sp.SkeletonData") {
                    let skeletonData = JSON.parse(fs.readFileSync(realPath, 'utf-8'));
                    let skeletonDataJson = skeletonData[5][0][4];
                    let skeletonDataJsonString = JSON.stringify(skeletonDataJson);
                    if (!skeletonDataJsonString) {
                        console.error("skeletonDataJsonString is null");
                    } else {
                        fs.writeFileSync(outFilePath, skeletonDataJsonString);
                    }
                    // console.log("write file: " + outFilePath);
                }

                if (typeName === "cc.BitmapFont") {
                    console.log("bitmapFont: 处理bmfont字体文件 " + outFilePath);
                    let contentJson = JSON.parse(fs.readFileSync(outFilePath, 'utf-8'));
                    if (contentJson[5]?.[0]?.[3]?.atlasName) {
                        let bmfont = contentJson[5]?.[0]?.[3];
                        let atlasName = bmfont?.atlasName;
                        // 修改扩展用png 来做字体图
                        let newAtlasName = atlasName.replace(".webp", ".png");

                        let oldAtlasPath = path.join(path.dirname(outFilePath), atlasName);
                        let newAtlasPath = path.join(path.dirname(outFilePath), newAtlasName);
                        dealTaskList.push(() => {
                            if (fs.existsSync(oldAtlasPath)) {
                                fs.renameSync(oldAtlasPath, newAtlasPath);
                            }
                        });
                        let fntName = atlasName.replace(".webp", ".fnt");
                        let fntContent = jsonToFnt(bmfont);
                        let fntPath = path.join(path.dirname(outFilePath), fntName);
                        fs.writeFileSync(fntPath, fntContent);
                    }
                }

            }
        }
        realPath = path.join(nativePath, top, decompressedUuid);
        ext = findExt(realPath);
        if (ext && (ext === ".atlas" || typeName !== "cc.Asset")) {
            ext = ext.replace(".astc", ".webp");
            realPath += ext;
            if (fs.existsSync(realPath)) {
                let outFilePath = path.join(outPath, `${filePath}${ext}`);
                // console.log("copy file: " + realPath + " to " + outFilePath);
                if (!fs.existsSync(outFilePath)) {
                    fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
                }
                fs.copyFileSync(realPath, outFilePath);
                if (typeName === "sp.SkeletonData") {
                    let skeletonData = JSON.parse(fs.readFileSync(realPath, 'utf-8'));
                    let skeletonDataJson = skeletonData[5][0][4];
                    let skeletonDataJsonString = JSON.stringify(skeletonDataJson);
                    if (!skeletonDataJsonString) {
                        console.error("skeletonDataJsonString is null");
                    } else {
                        fs.writeFileSync(outFilePath, skeletonDataJsonString);
                    }
                }
            }

            // let importData = JSON.parse()


        }
    }


    {
        // 处理未处理的任务
        for (const task of dealTaskList) {
            task();
        }
    }



    {
        // console.log("开始转化为plist文件");
        // 转化为plist文件
        for (const key in packs) {
            let pack = packs[key];

            let top = key.slice(0, 2);
            let importPath = path.join(improtPath, top, key);
            importPath += ".json";

            if (fs.existsSync(importPath)) {
                let importContent = fs.readFileSync(importPath, 'utf-8');
                let importData = JSON.parse(importContent);
                // console.log(importData[1]);
                let compressuuid = importData[1]?.[0];
                if (compressuuid) {
                    let idx = uuids.indexOf(compressuuid);
                    if (idx !== -1) {
                        let filePath = paths[idx + '']?.[0];
                        if (filePath) {
                            let targetPath = path.join(outPath, `${filePath}.tmp.json`);
                            let targetPlist = path.join(outPath, `${filePath}.plist`);
                            if (!fs.existsSync(path.dirname(targetPath))) {
                                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                            }
                            fs.copyFileSync(importPath, targetPath);
                            convertJSONToPlist(targetPath, targetPlist);
                            fs.rmSync(targetPath);
                        }

                    }

                }
            }


        }

    }


    processCallback?.(10);
    {
        // 导出图集
        const plistFiles = findAllPlistFiles(outPath);
        let idx = 0;
        for (let plistFile of plistFiles) {
            let webpPath = plistFile.replace(".plist", ".webp");
            if (!fs.existsSync(webpPath)) {
                continue;
            }
            processCallback?.(10 + (idx / plistFiles.length) * 90);
            await sliceAtlas(webpPath, plistFile);
            idx++;
        }
        // 可以在这里对 plistFiles 做后续处理，例如输出或进一步操作：
        // console.log('所有找到的plist文件:', plistFiles);
    }




}



function findExt(realPath: string) {
    let ext = "";
    // console.log(realPath);
    // 如果 realPath 所在的目录不存在，直接返回 ""
    if (!fs.existsSync(path.dirname(realPath))) {
        return "";
    }
    const files = fs.readdirSync(path.dirname(realPath));
    for (const file of files) {
        const basename = path.basename(file, path.extname(file));
        if (basename === path.basename(realPath)) {
            ext = path.extname(file);
            return ext;
        }
    }
    return "";
}

// 递归遍历 outPath 目录下所有 .plist 文件
function findAllPlistFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(findAllPlistFiles(filePath)); // 递归子目录
        } else if (stat && stat.isFile() && file.endsWith('.plist')) {
            results.push(filePath);
        }
    }
    return results;
}



function jsonToFnt(jsonData: any) {
    // 计算纹理图集的最大宽度和高度
    let maxWidth = 0;
    let maxHeight = 0;

    // 遍历所有字符，找到最大的x+width和y+height
    Object.values(jsonData.fontDefDictionary).forEach((char: any) => {
        const rect = char.rect;
        maxWidth = Math.max(maxWidth, rect.x + rect.width);
        maxHeight = Math.max(maxHeight, rect.y + rect.height);
    });

    // 构建fnt格式字符串
    let fntContent = '';

    // info行
    fntContent += `info face="CustomFont" size=${jsonData.fontSize} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1 outline=0\n`;

    // common行
    fntContent += `common lineHeight=${jsonData.commonHeight} base=${jsonData.commonHeight} scaleW=${maxWidth} scaleH=${maxHeight} pages=1 packed=0\n`;

    // page行
    fntContent += `page id=0 file="${jsonData.atlasName}"\n`;

    // chars行
    const charCount = Object.keys(jsonData.fontDefDictionary).length;
    fntContent += `chars count=${charCount}\n`;

    // 每个字符的定义行
    Object.entries(jsonData.fontDefDictionary).forEach(([charId, charData]: any) => {
        const rect = charData.rect;
        fntContent += `char id=${charId} x=${rect.x} y=${rect.y} width=${rect.width} height=${rect.height} xoffset=${charData.xOffset} yoffset=${charData.yOffset} xadvance=${charData.xAdvance} page=0 chnl=15\n`;
    });

    // 如果有字距调整数据，添加kernings部分
    if (jsonData.kerningDict && Object.keys(jsonData.kerningDict).length > 0) {
        fntContent += `kernings count=${Object.keys(jsonData.kerningDict).length}\n`;
        Object.entries(jsonData.kerningDict).forEach(([first, secondDict]) => {
            Object.entries(secondDict).forEach(([second, amount]) => {
                fntContent += `kerning first=${first} second=${second} amount=${amount}\n`;
            });
        });
    }

    return fntContent;
}
