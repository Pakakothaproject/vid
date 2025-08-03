# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file in the root of the project and add your API keys:
   ```
   API_KEY=your_gemini_api_key
   NEWSDATA_API_KEY=your_newsdata_io_api_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```
   Replace the placeholder values with your actual keys.
3. Run the app:
   `npm run dev`

## Deploying

When deploying to a hosting platform like Vercel or Netlify, ensure you set the `API_KEY` and `NEWSDATA_API_KEY` as environment variables in your project's settings.

## E2E Video Generation

To run the video generation automation, you will need to set the above environment variables, as well as `WEBSITE_URL` (for a deployed version of the app) and `CLOUDINARY_UPLOAD_PRESET` in your environment (or in GitHub secrets for the action).
