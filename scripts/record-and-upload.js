
import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// --- Cloudinary Information ---
// These details should be configured for your Cloudinary account.
const CLOUDINARY_CLOUD_NAME = 'dho5purny';
const CLOUDINARY_API_KEY = '713687168633254';
const CLOUDINARY_API_SECRET = 'PW8nE1ifedZuzFejaZkvjlj8az0'; // Required for signed presets
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

    const outputDir = path.join(process.cwd(), 'videos');
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // Start timing right before creating the context, which is when Playwright starts recording.
    const recordingStartTime = Date.now();

    const context = await browser.newContext({
      viewport: { width: 360, height: 640 },
      recordVideo: { dir: outputDir, size: { width: 360, height: 640 } }
    });
    const page = await context.newPage();

    console.log(`Navigating to ${WEBSITE_URL}?mode=record...`);
    await page.goto(`${WEBSITE_URL}?mode=record`, { waitUntil: 'networkidle' });

    console.log('Waiting for "Generate Story" button...');
    const generateButton = page.getByTestId('generate-story-button');
    await generateButton.waitFor({ state: 'visible', timeout: 60000 });

    console.log('Clicking button to start generation...');
    await generateButton.click();

    console.log('Waiting for generation to complete (looking for "Play Preview" button)... This may take several minutes.');
    const playButton = page.getByTestId('play-preview-button');
    await playButton.waitFor({ state: 'visible', timeout: 8 * 60 * 1000 });
    console.log('Generation complete.');
    
    // Calculate the duration of the "dead air" at the start of the video.
    // This is the time from when recording started until the moment we click play.
    const trimDurationInSeconds = (Date.now() - recordingStartTime) / 1000;
    console.log(`Calculated video trim offset: ${trimDurationInSeconds.toFixed(2)}s`);

    await page.waitForTimeout(1000); // Brief pause before starting
    console.log('Starting playback and recording...');
    await playButton.click();
    
    // Wait for playback to finish by monitoring the button's disabled state
    const selector = '[data-testid="play-preview-button"]';
    await page.waitForFunction(sel => document.querySelector(sel)?.disabled, selector, { timeout: 10000 });
    console.log("Playback in progress...")
    await page.waitForFunction(sel => !document.querySelector(sel)?.disabled, selector, { timeout: 120000 });
    console.log('Playback finished.');
    
    await page.waitForTimeout(3000); // Allow time for audio processing to finalize.

    console.log('Retrieving recorded audio data from page...');
    const audioBase64 = await page.evaluate(async () => {
        for (let i = 0; i < 10; i++) { // Poll for 10 seconds
            if (window.recordedAudioBase64) {
                return window.recordedAudioBase64;
            }
            await new Promise(res => setTimeout(res, 1000));
        }
        return null;
    });

    if (!audioBase64) {
        throw new Error("Could not retrieve recorded audio from the page.");
    }
    const audioPath = path.join(outputDir, 'audio.webm');
    fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));
    console.log(`Saved audio: ${audioPath}`);


    console.log('Capturing final screenshot...');
    const screenshotPath = path.join(outputDir, `final-view-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${screenshotPath}`);

    console.log('Closing browser context to save video...');
    await context.close();
    const rawVideoFile = fs.readdirSync(outputDir).find(f => f.endsWith('.webm') && f !== 'audio.webm');
    if (!rawVideoFile) throw new Error("Could not find the recorded video file.");
    const rawVideoPath = path.join(outputDir, rawVideoFile);
    console.log(`Saved raw video: ${rawVideoPath}`);

    // --- Combine video and audio using ffmpeg ---
    const finalVideoPath = path.join(outputDir, 'final_video.mp4');
    console.log('Combining and synchronizing video and audio with ffmpeg...');
    try {
        // Use a complex filter to trim the start of the video and synchronize it with the audio.
        // [0:v]trim=start=${...}: Takes the video stream and cuts the "dead air" from the beginning.
        // setpts=PTS-STARTPTS: Resets the timestamp of the trimmed video so it starts at 0.
        // [v] and [a] are labels for the processed video and audio streams.
        // -map "[v]" -map "[a]": Selects the processed streams for the output file.
        const ffmpegCommand = `ffmpeg -i "${rawVideoPath}" -i "${audioPath}" -filter_complex "[0:v]trim=start=${trimDurationInSeconds},setpts=PTS-STARTPTS[v];[1:a]asetpts=PTS-STARTPTS[a]" -map "[v]" -map "[a]" -c:v libx264 -c:a aac -shortest "${finalVideoPath}"`;
        
        execSync(ffmpegCommand, { stdio: 'inherit' });

        console.log(`✅ Combined video saved: ${finalVideoPath}`);
    } catch (ffmpegError) {
        console.error('ffmpeg command failed:', ffmpegError);
        throw ffmpegError;
    }

    // --- Upload Screenshot ---
    try {
      console.log('Uploading screenshot...');
      const res = await cloudinary.uploader.upload(screenshotPath, {
        resource_type: 'image',
        upload_preset: CLOUDINARY_UPLOAD_PRESET,
        folder: CLOUDINARY_UPLOAD_FOLDER,
      });
      console.log('✅ Screenshot URL:', res.secure_url);
    } catch (err) {
      console.error('Screenshot upload failed:', err);
    }

    // --- Upload Final Video ---
    try {
      console.log('Uploading final video...');
      const resVid = await cloudinary.uploader.upload(finalVideoPath, {
        resource_type: 'video',
        upload_preset: CLOUDINARY_UPLOAD_PRESET,
        folder: CLOUDINARY_UPLOAD_FOLDER,
      });
      console.log('✅ Final video URL:', resVid.secure_url);
    } catch (err) {
      console.error('Video upload failed:', err);
    }

  } catch (error) {
    console.error('An error occurred during the automation script:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (fs.existsSync(path.join(process.cwd(), 'videos'))) {
        fs.rmSync(path.join(process.cwd(), 'videos'), { recursive: true, force: true });
    }
    clearTimeout(scriptTimeoutId);
  }
})();
