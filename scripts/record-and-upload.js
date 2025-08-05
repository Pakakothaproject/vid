
import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import https from 'https';

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

// --- Intro Video URLs per Day of the Week ---
const introVideoUrls = {
  'Sunday': 'https://res.cloudinary.com/dho5purny/video/upload/v1754354104/sample/ridwan/qfkdzukdhtplqipni1wk.mp4',
  'Monday': 'https://res.cloudinary.com/dho5purny/video/upload/v1754354096/sample/ridwan/kdah8pasmfxxvezd1lwo.mp4',
  'Tuesday': 'https://res.cloudinary.com/dho5purny/video/upload/v1754354111/sample/ridwan/djdpk5yjl8ngovtjlt0k.mp4',
  'Wednesday': 'https://res.cloudinary.com/dho5purny/video/upload/v1754354114/sample/ridwan/pp99oyk2ddthu5ufscao.mp4',
  'Thursday': 'https://res.cloudinary.com/dho5purny/video/upload/v1754354107/sample/ridwan/rsl2k38rnqgrvyanw59w.mp4',
  'Friday': 'https://res.cloudinary.com/dho5purny/video/upload/v1754354093/sample/ridwan/o1p80895jrjfm3vhj1mb.mp4',
  'Saturday': 'https://res.cloudinary.com/dho5purny/video/upload/v1754354099/sample/ridwan/cilxufz54neybplomrth.mp4'
};

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
    browser = await chromium.launch({ 
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'] 
    });

    const outputDir = path.join(process.cwd(), 'videos');
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // --- Download Intro Video ---
    const dayOfWeek = new Date().toLocaleString('en-us', { weekday: 'long' });
    const introVideoUrl = introVideoUrls[dayOfWeek];
    console.log(`Today is ${dayOfWeek}, downloading the corresponding intro video...`);

    const introVideoPath = path.join(outputDir, 'intro.mp4');
    await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(introVideoPath);
        https.get(introVideoUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${introVideoUrl}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('✅ Intro video downloaded.');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(introVideoPath, () => {}); // A-sync cleanup
            reject(err);
        });
    });

    // Start timing right before creating the context, which is when Playwright starts recording.
    const recordingStartTime = Date.now();

    const context = await browser.newContext({
      viewport: { width: 540, height: 960 },
      recordVideo: { dir: outputDir, size: { width: 540, height: 960 } }
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
    const trimOffset = 2; // Extra 2 seconds trim as requested
    const trimDurationInSeconds = ((Date.now() - recordingStartTime) / 1000) + trimOffset;
    console.log(`Calculated video trim offset: ${trimDurationInSeconds.toFixed(2)}s (including ${trimOffset}s extra delay)`);

    await page.waitForTimeout(1000); // Brief pause before starting
    console.log('Starting playback and recording...');
    await playButton.click();
    
    console.log('Playback in progress... waiting for the final logo trigger.');
    await page.waitForFunction(() => window.finalLogoAppeared === true, null, { timeout: 120000 });
    console.log('Final logo trigger received. Waiting for animation to complete.');

    // The animation sequence in the app runs for 1 second after the trigger.
    // We wait for that to complete, plus a small safety buffer to ensure all window variables are set.
    await page.waitForTimeout(1200);
    console.log('Playback finished.');
    
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

    console.log('Retrieving precise playback duration from page...');
    const mainSegmentDuration = await page.evaluate(async () => {
        for (let i = 0; i < 10; i++) {
             if (window.playbackDuration) {
                return window.playbackDuration;
            }
            await new Promise(res => setTimeout(res, 500));
        }
        return null;
    });

    if (!mainSegmentDuration) {
      throw new Error("Could not retrieve precise animation duration from the page. Final video may be cut short.");
    }

    console.log('Capturing final screenshot...');
    const screenshotPath = path.join(outputDir, `final-view-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${screenshotPath}`);

    console.log('Retrieving generated news data from page...');
    const generatedVideoData = await page.evaluate(() => window.generatedVideoData);

    // --- Assess Generated News Content ---
    if (!generatedVideoData || !generatedVideoData.news) {
      console.warn("Could not retrieve generated news data. Assessment and Webhook will be skipped.");
    } else {
      console.log('\n--- Assessing Generated News Content ---');
  
      const newsItems = generatedVideoData.news;
      const newsCount = newsItems.length;
  
      console.log(`[Assessment] Found ${newsCount} news items.`);
      if (newsCount !== 5) {
          console.warn(`[Assessment] WARNING: Expected 5 news items, but found ${newsCount}.`);
      }
  
      const headlines = newsItems.map(item => (item.headline_en || item.headline).trim());
      const uniqueHeadlines = new Set(headlines);
  
      if (uniqueHeadlines.size < headlines.length) {
          console.warn('[Assessment] WARNING: Duplicate news headlines detected!');
          const headlineCounts = headlines.reduce((acc, value) => {
              acc[value] = (acc[value] || 0) + 1;
              return acc;
          }, {});
          
          const duplicates = Object.keys(headlineCounts).filter(key => headlineCounts[key] > 1);
          console.warn('[Assessment] The following headlines appear more than once:');
          duplicates.forEach(h => console.warn(`- "${h}" (found ${headlineCounts[h]} times)`));
      } else {
          console.log('[Assessment] All news headlines are unique.');
      }
  
      console.log('--- End of News Content Assessment ---\n');
    }

    console.log('Closing browser context to save video...');
    await context.close();
    const rawVideoFile = fs.readdirSync(outputDir).find(f => f.endsWith('.webm') && f !== 'audio.webm');
    if (!rawVideoFile) throw new Error("Could not find the recorded video file.");
    const rawVideoPath = path.join(outputDir, rawVideoFile);
    console.log(`Saved raw video: ${rawVideoPath}`);

    // --- Combine video and audio using ffmpeg ---
    const finalVideoPath = path.join(outputDir, 'final_video.mp4');
    console.log('Combining intro, main video, and audio with ffmpeg...');
    try {
        const getDuration = (filePath) => {
            const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
            return parseFloat(execSync(command).toString().trim());
        };

        const introDuration = getDuration(introVideoPath);
        
        // The final video's duration is the sum of the intro and the precise main segment
        // duration retrieved from the browser's high-resolution audio context timer.
        const finalVideoDuration = introDuration + mainSegmentDuration;

        console.log(`Calculated durations: Intro=${introDuration.toFixed(2)}s, Main Segment (from App)=${mainSegmentDuration.toFixed(2)}s`);
        console.log(`Total video duration will be: ${finalVideoDuration.toFixed(2)}s`);

        if (finalVideoDuration <= 0) {
            throw new Error("Calculated final duration is zero or negative. Cannot create video.");
        }

        const ffmpegCommand = `ffmpeg -i "${introVideoPath}" -i "${rawVideoPath}" -i "${audioPath}" -filter_complex "[1:v]trim=start=${trimDurationInSeconds},setpts=PTS-STARTPTS[v_trimmed]; [v_trimmed]scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v_main]; [0:v]scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v_intro]; [v_intro][0:a][v_main][2:a]concat=n=2:v=1:a=1[v_out][a_out]" -map "[v_out]" -map "[a_out]" -c:v libx264 -c:a aac -movflags +faststart -t ${finalVideoDuration} "${finalVideoPath}"`;

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
    let finalVideoUrl;
    try {
      console.log('Uploading final video...');
      const resVid = await cloudinary.uploader.upload(finalVideoPath, {
        resource_type: 'video',
        upload_preset: CLOUDINARY_UPLOAD_PRESET,
        folder: CLOUDINARY_UPLOAD_FOLDER,
      });
      console.log('✅ Final video URL:', resVid.secure_url);
      finalVideoUrl = resVid.secure_url;
    } catch (err) {
      console.error('Video upload failed:', err);
    }

    // --- Send to Webhook ---
    if (finalVideoUrl && generatedVideoData) {
      const { news, hashtags_en, hashtags_bn } = generatedVideoData;
    
      const englishHeadlines = news.map((item, index) => `${index + 1}. ${item.headline_en}`).join('\\n');
      const banglaHeadlines = news.map((item, index) => `${index + 1}. ${item.headline}`).join('\\n');
      
      const videoDescription = `${englishHeadlines}\\n\\n🔹 Bangla Headlines\\n${banglaHeadlines}\\n\\n${hashtags_en}\\n${hashtags_bn}`;
      
      const webhookUrl = 'https://hook.us2.make.com/urbj1s7e81g3g59di6uaadxy302882xp';
      const payload = {
          videoLink: finalVideoUrl,
          videoDescription: videoDescription,
      };

      try {
          await new Promise((resolve, reject) => {
              const payloadString = JSON.stringify(payload);
              const options = {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Content-Length': Buffer.byteLength(payloadString),
                  },
              };

              const req = https.request(webhookUrl, options, (res) => {
                  let data = '';
                  res.on('data', (chunk) => { data += chunk; });
                  res.on('end', () => {
                      console.log(`Webhook response status: ${res.statusCode}`);
                      console.log('Webhook response body:', data);
                      if (res.statusCode >= 200 && res.statusCode < 300) {
                          resolve(data);
                      } else {
                          reject(new Error(`Webhook request failed with status ${res.statusCode}: ${data}`));
                      }
                  });
              });

              req.on('error', (e) => {
                  console.error('Error sending POST request to webhook:', e);
                  reject(e);
              });

              req.write(payloadString);
              req.end();
          });
          console.log('✅ Successfully sent data to webhook.');
      } catch (webhookError) {
          console.error('Failed to send data to webhook:', webhookError);
      }
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
