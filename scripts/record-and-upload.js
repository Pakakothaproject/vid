import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// --- Hardcoded Cloudinary Information ---
const CLOUDINARY_CLOUD_NAME = 'dho5purny';
const CLOUDINARY_API_KEY = '638794639617948';
const CLOUDINARY_UPLOAD_PRESET = 'PakaKotha';

// --- Environment Variable Validation ---
const { WEBSITE_URL } = process.env;

if (!WEBSITE_URL) {
  console.error(`Error: Environment variable WEBSITE_URL is not set.`);
  process.exit(1);
}

// --- Cloudinary Configuration ---
// Omit api_secret to ensure unsigned uploads use your preset without generating signatures
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
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

    await page.waitForTimeout(1000);

    console.log('Clicking "Play Preview"...');
    await playButton.click();

    const selector = '[data-testid="play-preview-button"]';

    console.log('Playback started. Waiting for button to disable...');
    await page.waitForFunction(
      sel => document.querySelector(sel)?.disabled,
      selector,
      { timeout: 10000 }
    );

    console.log('Waiting for playback to finish (button re-enabled)...');
    await page.waitForFunction(
      sel => !document.querySelector(sel)?.disabled,
      selector,
      { timeout: 120000 }
    );
    console.log('Playback finished.');

    console.log('Pausing briefly to capture final frames...');
    await page.waitForTimeout(3000);

    console.log('Taking a final screenshot...');
    const screenshotPath = path.join(outputDir, `final-view-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Local screenshot saved: ${screenshotPath}`);

    console.log('Closing browser context to save video...');
    await context.close();
    const videoPath = fs.readdirSync(outputDir)
      .filter(f => f.endsWith('.webm'))
      .map(file => path.join(outputDir, file))[0];
    console.log(`Local video saved: ${videoPath}`);

    // --- Upload Screenshot (unsigned) ---
    try {
      console.log('Uploading screenshot unsigned at Cloudinary...');
      const screenshotRes = await cloudinary.uploader.unsigned_upload(
        screenshotPath,
        {
          resource_type: 'image',
          upload_preset: CLOUDINARY_UPLOAD_PRESET,
        }
      );
      console.log(`✅ Screenshot URL: ${screenshotRes.secure_url}`);
      fs.unlinkSync(screenshotPath);
    } catch (uploadErr) {
      console.error('Screenshot upload failed:', uploadErr);
    }

    // --- Upload Video (unsigned) ---
    try {
      console.log('Uploading video unsigned at Cloudinary...');
      const videoRes = await cloudinary.uploader.unsigned_upload(
        videoPath,
        {
          resource_type: 'video',
          upload_preset: CLOUDINARY_UPLOAD_PRESET,
        }
      );
      console.log(`✅ Video URL: ${videoRes.secure_url}`);
      fs.unlinkSync(videoPath);
    } catch (uploadErr) {
      console.error('Video upload failed:', uploadErr);
    }

  } catch (error) {
    console.error('An error occurred:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    clearTimeout(scriptTimeoutId);
  }
})();
