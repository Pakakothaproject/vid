import { chromium } from 'playwright';
import path from 'path';

const WEBSITE_URL = process.env.WEBSITE_URL;
if (!WEBSITE_URL) {
  console.error("Error: WEBSITE_URL environment variable is not set.");
  process.exit(1);
}

// Timeouts
const SCRIPT_TIMEOUT = 10 * 60 * 1000; // 10 minutes for the whole script
const SELECTOR_TIMEOUT = 5 * 60 * 1000; // 5 minutes for generation to complete

(async () => {
  const scriptTimeoutId = setTimeout(() => {
    console.error(`Script timed out after ${SCRIPT_TIMEOUT / 60000} minutes.`);
    process.exit(1);
  }, SCRIPT_TIMEOUT);

  let browser;
  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: true });

    const videoDir = path.join(process.cwd(), 'videos');
    const context = await browser.newContext({
      viewport: { width: 380, height: 700 }, // A bit larger to see everything
      recordVideo: {
        dir: videoDir,
        size: { width: 360, height: 640 } // Match player size
      }
    });
    const page = await context.newPage();

    console.log(`Navigating to ${WEBSITE_URL}...`);
    await page.goto(WEBSITE_URL, { waitUntil: 'networkidle' });

    console.log('Waiting for "Generate Story" or "Try Again" button...');
    const generateButton = page.getByRole('button', { name: /generate story|try again/i });
    await generateButton.waitFor({ state: 'visible', timeout: 60000 });

    console.log('Clicking button to start generation...');
    await generateButton.click();

    console.log(`Waiting for generation to complete (looking for "Play Preview" button)... This may take several minutes.`);
    const playButton = page.getByRole('button', { name: /play preview/i });
    // Use a long timeout because AI generation can be slow
    await playButton.waitFor({ state: 'visible', timeout: SELECTOR_TIMEOUT });
    console.log('Generation complete. "Play Preview" button is visible.');
    
    // Brief pause to ensure all elements are settled after the state change
    await page.waitForTimeout(2000);

    console.log('Clicking "Play Preview"...');
    await playButton.click();

    console.log('Playback started. Waiting for completion (looking for "Generate New" button)...');
    // The "Generate New" button appears when the animation sequence is over.
    const generateNewButton = page.getByRole('button', { name: /generate new/i });
    await generateNewButton.waitFor({ state: 'visible', timeout: 120000 }); // 2 minutes for playback

    console.log('Playback finished.');
    
    // Closing the context is essential to save the video file.
    console.log('Closing browser context to save video...');
    const videoPath = await page.video().path(); // Get the path before closing
    await context.close();

    console.log(`✅ Video saved successfully! Path: ${videoPath}`);

  } catch (error) {
    console.error('An error occurred during the automation script:', error);
    process.exitCode = 1; // Set exit code to 1 to fail the GitHub Action
  } finally {
    if (browser) {
      await browser.close();
    }
    clearTimeout(scriptTimeoutId);
  }
})();
