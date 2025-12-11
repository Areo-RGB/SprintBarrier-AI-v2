import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputFile = 'ico.png';
const outputDir = 'public';

if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
}

async function generateIcons() {
    try {
        console.log(`Generating icons from ${inputFile}...`);
        
        await sharp(inputFile)
            .resize(192, 192)
            .toFile(path.join(outputDir, 'pwa-192x192.png'));
        console.log('Created public/pwa-192x192.png');

        await sharp(inputFile)
            .resize(512, 512)
            .toFile(path.join(outputDir, 'pwa-512x512.png'));
        console.log('Created public/pwa-512x512.png');

        // Generate favicon as well since we are here
        await sharp(inputFile)
            .resize(64, 64)
            .toFile(path.join(outputDir, 'favicon.ico'));
         console.log('Created public/favicon.ico');

    } catch (err) {
        console.error('Error generating icons:', err);
    }
}

generateIcons();
