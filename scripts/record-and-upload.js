
import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// --- Hardcoded Cloudinary Information ---
const CLOUDINARY_CLOUD_NAME = 'dho5purny';
const CLOUDINARY_API_KEY = '638794639617948';
const CLOUDINARY_API_SECRET = '3yMjatIurlyBdmX-TJm1e1wdI5c';
const CLOUDINARY_UPLOAD_PRESET = 'PakaKotha';

// --- Environment Variable Validation ---
const { WEBSITE_URL } = process.env;

if (!WEBSITE_URL) {
    console.error(`Error: Environment variable WEBSITE_URL is not set.`);
    process.exit(1);
}

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

// --- Main Automation Logic ---
const SCRIPT_TIMEOUT = 10 * 60 * 1000; // 10 minutes

(async () => {
    const scriptTimeoutId = setTimeout(() => {
        console.error(`Script timed out after ${SCRIPT_TIMEOUT / 60000} minutes.`);
        process.exit(1);
    }, SCRIPT_TIMEOUT);

    let browser;
    try {
        console.log('Launching browser...');
        browser = await chromium.launch({ headless: true });

        const outputDir = path.join(process.cwd(), 'output');
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const context = await browser.newContext({
            viewport: { width: 380, height: 700 },
            recordVideo: {
                dir: outputDir,
                size: { width: 360, height: 640 }
            }
        });
        const page = await context.newPage();

        console.log(`Navigating to ${WEBSITE_URL}...`);
        await page.goto(WEBSITE_URL, { waitUntil: 'networkidle' });

        console.log('Waiting for "Generate Story" button...');
        const generateButton = page.getByTestId('generate-story-button');
        await generateButton.waitFor({ state: 'visible', timeout: 60000 });

        console.log('Clicking button to start generation...');
        await generateButton.click();

        console.log('Waiting for generation to complete (looking for "Play Preview" button)... This may take several minutes.');
        const playButton = page.getByTestId('play-preview-button');
        await playButton.waitFor({ state: 'visible', timeout: 5 * 60 * 1000 });
        console.log('Generation complete. "Play Preview" button is visible.');
        
        await page.waitForTimeout(1000); // Brief pause before playing

        console.log('Clicking "Play Preview"...');
        await playButton.click();

        const playButtonSelector = '[data-testid="play-preview-button"]';

        console.log('Playback started. Waiting for "Play Preview" button to become disabled...');
        await page.waitForFunction(
            (selector) => document.querySelector(selector)?.disabled,
            playButtonSelector,
            { timeout: 10000 }
        );
        console.log('Playback in progress...');

        console.log('Waiting for playback to finish (for "Play Preview" button to be re-enabled)...');
        await page.waitForFunction(
            (selector) => !document.querySelector(selector)?.disabled,
            playButtonSelector,
            { timeout: 120000 }
        );
        console.log('Playback finished.');
        
        console.log('Pausing for a moment to ensure final frames are recorded...');
        await page.waitForTimeout(3000); // Wait for animations to settle

        console.log('Taking a final screenshot...');
        const screenshotPath = path.join(outputDir, `final-view-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Local screenshot saved: ${screenshotPath}`);

        console.log('Closing browser context to save video...');
        await context.close(); // This saves the video
        const videoPath = await page.video().path(); // Now get the path
        console.log(`Local video saved: ${videoPath}`);

        // Upload screenshot
        try {
            console.log('Uploading screenshot to Cloudinary...');
            const screenshotUploadResult = await cloudinary.uploader.upload(screenshotPath, {
                resource_type: 'image',
                upload_preset: CLOUDINARY_UPLOAD_PRESET,
            });
            console.log(`✅ Screenshot uploaded successfully! URL: ${screenshotUploadResult.secure_url}`);
            
            console.log('Deleting local screenshot file...');
            fs.unlinkSync(screenshotPath);
            console.log('Local screenshot file deleted.');
        } catch (uploadError) {
            console.error('An error occurred during screenshot upload:', uploadError);
            // Don't exit, still try to upload the video
        }

        // Upload video
        console.log('Uploading video to Cloudinary...');
        const videoUploadResult = await cloudinary.uploader.upload(videoPath, {
            resource_type: 'video',
            upload_preset: CLOUDINARY_UPLOAD_PRESET,
        });
        console.log(`✅ Video uploaded successfully! URL: ${videoUploadResult.secure_url}`);
        
        console.log('Deleting local video file...');
        fs.unlinkSync(videoPath);
        console.log('Local video file deleted.');

    } catch (error) {
        console.error('An error occurred during the automation script:', error);
        process.exitCode = 1;
    } finally {
        if (browser) {
            await browser.close();
        }
        clearTimeout(scriptTimeoutId);
    }
})();
