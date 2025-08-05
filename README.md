# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**
* Node.js
* ffmpeg (required for the `generate-video` script)


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file in the root of the project and add your API keys:
   ```
   API_KEY=your_primary_gemini_api_key
   API_KEY2=your_fallback_gemini_api_key
   NEWSDATA_API_KEY=your_newsdata_io_api_key
   ```
   Replace the placeholder values with your actual keys. The `API_KEY2` is used as a fallback if the primary key fails during audio generation.
3. Run the app:
   `npm run dev`

## Deploying

When deploying to a hosting platform like Vercel or Netlify, ensure you set the `API_KEY`, `API_KEY2`, and `NEWSDATA_API_KEY` as environment variables in your project's settings.

## E2E Video Generation

To run the video generation automation, you will need to set the above environment variables, as well as `WEBSITE_URL` (for a deployed version of the app) in your environment (or in GitHub secrets for the action). Ensure `ffmpeg` is installed in the environment where the script is run.