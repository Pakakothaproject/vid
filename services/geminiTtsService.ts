
import { GoogleGenAI } from '@google/genai';

/**
 * Encodes raw PCM audio data into a WAV file format.
 * The Gemini TTS API returns raw PCM data, which needs a WAV header
 * to be playable in browsers.
 * @param pcmData The raw audio data as an ArrayBuffer.
 * @param numChannels Number of audio channels (e.g., 1 for mono).
 * @param sampleRate The sample rate of the audio (e.g., 24000).
 * @param bytesPerSample The number of bytes per sample (e.g., 2 for 16-bit).
 * @returns An ArrayBuffer containing the complete WAV file data.
 */
const encodeWAV = (pcmData: ArrayBuffer, numChannels: number, sampleRate: number, bytesPerSample: number): ArrayBuffer => {
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.byteLength;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');

    // "fmt " sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample

    // "data" sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));

    return buffer;
};


/**
 * Converts a base64 string to an ArrayBuffer.
 * @param base64 The base64 encoded string.
 * @returns The decoded data as an ArrayBuffer.
 */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};


/**
 * Generates audio from text using the Google Gemini Text-to-Speech (TTS) API.
 * This is a preview feature that uses the generateContent method with an audio modality.
 * @param text The text to convert to speech (expected to be in Bengali).
 * @returns A promise that resolves to a local URL for the generated audio blob.
 */
export const generateAudio = async (text: string): Promise<string> => {
    // The Gemini API key is expected to be available as process.env.API_KEY in the execution environment.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: text,
            config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: 'Kore', // A neutral voice suitable for news
                        },
                    },
                },
            }
        });

        // The primary expected output is audio data. Check for it first.
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (audioData) {
            // The API returns base64-encoded raw PCM data.
            // 1. Decode base64 to get the raw PCM data.
            const pcmData = base64ToArrayBuffer(audioData.trim());

            // 2. Add a WAV header to the PCM data to make it a playable file.
            // These parameters are based on the Gemini TTS documentation/examples.
            const wavData = encodeWAV(pcmData, 1, 24000, 2); // 1 channel, 24kHz, 16-bit

            // 3. Create a blob from the complete WAV data.
            const audioBlob = new Blob([wavData], { type: 'audio/wav' });

            if (audioBlob.size <= 44) { // 44 bytes is the size of the header
                throw new Error("Received empty audio data from API.");
            }
            
            // 4. Create an object URL that the <audio> element can play.
            return URL.createObjectURL(audioBlob);
        }

        // If no audio data is found, the API call likely failed. Investigate the reason.
        
        // 1. Check for content blocking.
        const feedback = response.promptFeedback;
        if (feedback?.blockReason) {
            const message = `Audio generation blocked for text: "${text}". Reason: ${feedback.blockReason}. ${feedback.blockReasonMessage || ''}`;
            console.error(message);
            throw new Error(message);
        }

        // 2. Check if the API returned a text-based error message.
        // The .text accessor might return a warning even on success if non-text parts are present,
        // so we only treat it as an error if we've already confirmed there's no audio data.
        const errorText = response.text;
        if (errorText) {
            const message = `Gemini TTS returned a text response instead of audio for text: "${text}". Response: ${errorText}`
            console.error(message);
            throw new Error(message);
        }

        // 3. If no specific error is found, throw a generic failure message, but log the response first for debugging.
        console.error("Gemini TTS Raw Response on failure:", JSON.stringify(response, null, 2));
        throw new Error("Gemini TTS API did not return audio data or a clear error message.");

    } catch (error) {
        console.error(`Error in generateAudio with Gemini TTS for text: "${text}"`, error);
        // Re-throw the error to ensure it's caught by the component and displayed to the user.
        throw error;
    }
};
