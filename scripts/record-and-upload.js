const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const WEBSITE_URL = process.env.WEBSITE_URL;
const CLOUDINARY_CLOUD_NAME = 'dho5purny';
const CLOUDINARY_API_KEY = '638794639617948';
const CLOUDINARY_UPLOAD_PRESET = 'PakaKotha';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;

async function main() {
  if (!WEBSITE_URL) {
    console.error('Error: WEBSITE_URL environment variable is not set.');
    process.exit(1);
  }

  console.log('🚀 Starting browser automation...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: { dir: 'videos/' },
    viewport: { width: 360, height: 640 }, // Match the app's player dimensions
  });
  const page = await context.newPage();

  let videoPath = '';
  
  try {
    console.log(`Navigating to ${WEBSITE_URL}...`);
    await page.goto(WEBSITE_URL, { waitUntil: 'domcontentloaded' });
    
    console.log('✅ Page loaded. Looking for "Generate Story" button...');
    const generateButton = page.getByRole('button', { name: /Generate Story|Try Again/i });
    await generateButton.waitFor({ state: 'visible', timeout: 30000 });
    await generateButton.click();
    console.log('✅ Clicked "Generate Story". Waiting for AI processing...');
    
    console.log('⏳ Waiting for "Play Preview" button to become available (timeout: 3 minutes)...');
    const playButton = page.getByRole('button', { name: 'Play Preview' });
    await playButton.waitFor({ state: 'visible', timeout: 180000 });
    console.log('✅ Generation complete. "Play Preview" button is visible.');
    
    console.log('🎬 Clicking "Play Preview" to start playback...');
    await playButton.click();
    
    console.log('⏳ Recording video playback (waiting 75 seconds)...');
    await page.waitForTimeout(75000); // Wait for the video playback to complete
    console.log('✅ Playback finished.');

  } catch (error) {
    console.error('❌ An error occurred during browser automation:', error);
    process.exit(1);
  } finally {
    console.log('Closing browser and saving video...');
    videoPath = await page.video().path();
    await context.close();
    await browser.close();
    console.log(`✅ Video saved locally to: ${videoPath}`);
  }

  if (!fs.existsSync(videoPath)) {
      console.error('❌ Video file was not created. Aborting upload.');
      process.exit(1);
  }

  // Upload to Cloudinary
  try {
    console.log(`☁️ Uploading ${path.basename(videoPath)} to Cloudinary...`);
    const form = new FormData();
    form.append('file', fs.createReadStream(videoPath));
    form.append('api_key', CLOUDINARY_API_KEY);
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await axios.post(UPLOAD_URL, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    console.log('✅ Upload successful!');
    console.log('Cloudinary response:', JSON.stringify(response.data, null, 2));
    console.log(`➡️ Video URL: ${response.data.secure_url}`);

  } catch (uploadError) {
      console.error('❌ Cloudinary upload failed.');
      if (uploadError.response) {
          console.error('Error Response:', uploadError.response.data);
      } else {
          console.error(uploadError.message);
      }
      process.exit(1);
  } finally {
      console.log('Cleaning up local video file...');
      fs.unlinkSync(videoPath);
      console.log('✅ Cleanup complete.');
  }
}

main().catch(err => {
    console.error('A critical error occurred in the main function:', err);
    process.exit(1);
});
