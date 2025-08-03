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
   ```
   Replace `your_gemini_api_key` and `your_newsdata_io_api_key` with your actual keys.
3. Run the app:
   `npm run dev`

## Deploying

When deploying to a hosting platform like Vercel or Netlify, ensure you set the `API_KEY` and `NEWSDATA_API_KEY` as environment variables in your project's settings.
