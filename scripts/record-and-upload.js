import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// --- Hardcoded Cloudinary Information ---
const CLOUDINARY_CLOUD_NAME = 'dho5purny';
const CLOUDINARY_API_KEY = '638794639617948';
// Ensure this EXACTLY matches the preset name in your Cloudinary console
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'PakaKotha';

// --- Environment Variable Validation ---
const { WEBSITE_URL } = process.env;
if (!WEBSITE_URL) {
  console.error('Error: Environment variable WEBSITE_URL is not set.');
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

    console.log('Waiting for "Play Preview" button to appear...');
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

    // --- Upload Screenshot ---
    try {
      console.log(`Uploading screenshot with preset: ${CLOUDINARY_UPLOAD_PRESET}`);
      const res = await cloudinary.uploader.unsigned_upload(screenshotPath, {
        resource_type: 'image', upload_preset: CLOUDINARY_UPLOAD_PRESET
      });
      console.log('✅ Screenshot URL:', res.secure_url);
      fs.unlinkSync(screenshotPath);
    } catch (err) {
      console.error('Screenshot upload failed (preset may not exist):', err);
    }

    // --- Upload Video ---
    try {
      console.log(`Uploading video with preset: ${CLOUDINARY_UPLOAD_PRESET}`);
      const resVid = await cloudinary.uploader.unsigned_upload(videoPath, {
        resource_type: 'video', upload_preset: CLOUDINARY_UPLOAD_PRESET
      });
      console.log('✅ Video URL:', resVid.secure_url);
      fs.unlinkSync(videoPath);
    } catch (err) {
      console.error('Video upload failed (preset may not exist):', err);
    }

  } catch (error) {
    console.error('An error occurred:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    clearTimeout(scriptTimeoutId);
  }
})();
