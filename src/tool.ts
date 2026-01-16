const Base64KeyChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const AsciiTo64 = new Array(128);
for (let i = 0; i < 128; ++i) {
    AsciiTo64[i] = 0;
}
for (let i = 0; i < 64; ++i) {
    AsciiTo64[Base64KeyChars.charCodeAt(i)] = i;
}

/**
 * 解压uuid
 * @param uuid string
 * @returns string
 */
export function decompressUuid(uuid: string): string {
    // 确保 AsciiTo64 表存在，这里假定它已在全局或本模块中定义为 number[]
    // let AsciiTo64: number[] = [];
    // 按照 8-4-4-4-12 的 uuid 格式插入 '-'
    let rawHex = "";
    if (uuid.length === 23) {
        // 提取前5个字符
        rawHex = uuid.slice(0, 5);
        const e: string[] = [];
        for (let s = 5; s < 23; s += 2) {
            const r = AsciiTo64[uuid.charCodeAt(s)];
            const t = AsciiTo64[uuid.charCodeAt(s + 1)];
            e.push((r >> 2).toString(16));
            e.push((((3 & r) << 2) | (t >> 4)).toString(16));
            e.push((15 & t).toString(16));
        }
        rawHex += e.join("");
    } else if (uuid.length === 22) {
        rawHex = uuid.slice(0, 2);
        const e: string[] = [];
        for (let s = 2; s < 22; s += 2) {
            const r = AsciiTo64[uuid.charCodeAt(s)];
            const t = AsciiTo64[uuid.charCodeAt(s + 1)];
            e.push((r >> 2).toString(16));
            e.push((((3 & r) << 2) | (t >> 4)).toString(16));
            e.push((15 & t).toString(16));
        }
        rawHex += e.join("");
    } else {
        // 非压缩 uuid
        return uuid;
    }

    // 现在 rawHex 需要填充 32 位（8+4+4+4+12=32）
    // 部分前缀不足，因此要补零
    while (rawHex.length < 32) {
        rawHex += "0";
    }
    // 按 8-4-4-4-12 添加 '-'
    uuid = [
        rawHex.slice(0, 8),
        rawHex.slice(8, 12),
        rawHex.slice(12, 16),
        rawHex.slice(16, 20),
        rawHex.slice(20, 32)
    ].join("-");
    return uuid;
}
