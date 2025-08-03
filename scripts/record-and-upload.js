import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// --- Hardcoded Cloudinary Information ---
const CLOUDINARY_CLOUD_NAME = 'dho5purny';
const CLOUDINARY_API_KEY = '713687168633254';
const CLOUDINARY_API_SECRET = 'PW8nE1ifedZuzFejaZkvjlj8az0';
const CLOUDINARY_UPLOAD_PRESET = 'Ridwan';
const CLOUDINARY_UPLOAD_FOLDER = 'sample/ridwan';

// --- Environment Variable Validation ---
const { WEBSITE_URL } = process.env;
if (!WEBSITE_URL) {
  console.error('Error: Environment variable WEBSITE_URL is not set.');
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
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const context = await browser.newContext({
      viewport: { width: 380, height: 700 },
      recordVideo: { dir: outputDir, size: { width: 360, height: 640 } }
    });
    const page = await context.newPage();

    console.log(`Navigating to ${WEBSITE_URL}...`);
    await page.goto(WEBSITE_URL, { waitUntil: 'networkidle' });

    console.log('Waiting for "Generate Story" button...');
    const generateButton = page.getByTestId('generate-story-button');
    await generateButton.waitFor({ state: 'visible', timeout: 60000 });

    console.log('Clicking button to start generation...');
    await generateButton.click();

    console.log('Waiting for "Play Preview" button...');
    const playButton = page.getByTestId('play-preview-button');
    await playButton.waitFor({ state: 'visible', timeout: 5 * 60 * 1000 });
    console.log('Generation complete.');

    await page.waitForTimeout(1000);
    console.log('Starting playback...');
    await playButton.click();

    const selector = '[data-testid="play-preview-button"]';
    await page.waitForFunction(sel => document.querySelector(sel)?.disabled, selector, { timeout: 10000 });
    await page.waitForFunction(sel => !document.querySelector(sel)?.disabled, selector, { timeout: 120000 });
    console.log('Playback finished.');

    await page.waitForTimeout(3000);
    console.log('Capturing final screenshot...');
    const screenshotPath = path.join(outputDir, `final-view-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${screenshotPath}`);

    console.log('Closing context to save video...');
    await context.close();
    const [videoFile] = fs.readdirSync(outputDir).filter(f => f.endsWith('.webm'));
    const videoPath = path.join(outputDir, videoFile);
    console.log(`Saved video: ${videoPath}`);

    // --- Upload Screenshot (signed) ---
    try {
      console.log('Uploading screenshot (signed)...');
      const res = await cloudinary.uploader.upload(screenshotPath, {
        resource_type: 'image',
        upload_preset: CLOUDINARY_UPLOAD_PRESET,
        folder: CLOUDINARY_UPLOAD_FOLDER
      });
      console.log('✅ Screenshot URL:', res.secure_url);
      fs.unlinkSync(screenshotPath);
    } catch (err) {
      console.error('Screenshot upload failed:', err);
    }

    // --- Upload Video (signed) ---
    try {
      console.log('Uploading video (signed)...');
      const resVid = await cloudinary.uploader.upload(videoPath, {
        resource_type: 'video',
        upload_preset: CLOUDINARY_UPLOAD_PRESET,
        folder: CLOUDINARY_UPLOAD_FOLDER
      });
      console.log('✅ Video URL:', resVid.secure_url);
      fs.unlinkSync(videoPath);
    } catch (err) {
      console.error('Video upload failed:', err);
    }

  } catch (error) {
    console.error('An error occurred:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    clearTimeout(scriptTimeoutId);
  }
})();
