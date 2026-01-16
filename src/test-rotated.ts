import { sliceAtlas } from "./slice-atlas";
import * as fs from 'fs';
import * as path from 'path';

async function test() {
    const imageDir = "D:\\suyu\\cocosRes\\activity-album\\out\\res\\pic\\ui_activity_cards_exchange";
    const imagePath = path.join(imageDir, "ui_activity_cards_exchange_0.webp");
    const plistPath = path.join(imageDir, "ui_activity_cards_exchange_0.plist");
    
    // 删除旧的输出目录
    const outputDir = path.join(imageDir, "ui_activity_cards_exchange_0_test");
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
    }
    
    console.log('Testing rotated frames...\n');
    await sliceAtlas(imagePath, plistPath, outputDir);
}

test();
