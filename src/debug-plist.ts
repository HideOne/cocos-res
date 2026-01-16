import * as fs from 'fs';
import { parseString } from 'xml2js';

const plistPath = "D:\\suyu\\cocosRes\\activity-album\\out\\res\\pic\\ui_activity_cards_exchange\\ui_activity_cards_exchange_0.plist";

async function debugPlist() {
    const xmlContent = fs.readFileSync(plistPath, 'utf8');
    
    parseString(xmlContent, (err: Error | null, result: any) => {
        if (err) {
            console.error('Parse error:', err);
            return;
        }

        console.log('=== Root structure ===');
        console.log('Keys:', Object.keys(result));
        
        console.log('\n=== plist.dict[0] ===');
        console.log('Keys:', Object.keys(result.plist.dict[0]));
        
        console.log('\n=== frames dict ===');
        const framesDict = result.plist.dict[0].dict[0];
        console.log('Keys in framesDict:', Object.keys(framesDict));
        console.log('Number of frame keys:', framesDict.key?.length);
        console.log('Number of frame dicts:', framesDict.dict?.length);
        
        if (framesDict.key && framesDict.key.length > 0) {
            console.log('\n=== First frame key ===');
            console.log(framesDict.key[0]);
        }
        
        if (framesDict.dict && framesDict.dict.length > 0) {
            console.log('\n=== First frame dict ===');
            console.log(JSON.stringify(framesDict.dict[0], null, 2));
        }
    });
}

debugPlist();
