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

const _performApiCall = async (text: string, apiKey: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    // Using a more explicit prompt to guide the TTS model, which can improve reliability.
    const instructionalPrompt = `Please read the following Bengali text aloud in a clear and steady narrative voice: "${text}"`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: instructionalPrompt,
        config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: 'Kore',
                    },
                },
            },
        }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (audioData && audioData.trim().length > 0) {
        const pcmData = base64ToArrayBuffer(audioData.trim());
        const wavData = encodeWAV(pcmData, 1, 24000, 2);
        const audioBlob = new Blob([wavData], { type: 'audio/wav' });

        if (audioBlob.size <= 44) { // 44 bytes is the size of the WAV header
            throw new Error("Received empty audio data from API.");
        }
        
        return URL.createObjectURL(audioBlob);
    }
    
    const feedback = response.promptFeedback;
    if (feedback?.blockReason) {
        const message = `Audio generation blocked. Reason: ${feedback.blockReason}. ${feedback.blockReasonMessage || ''}`;
        console.error(message, `Text: "${text.substring(0,50)}..."`);
        throw new Error(message); 
    }

    const errorText = response.text;
    if (errorText) {
        throw new Error(`Gemini TTS returned a text response instead of audio: ${errorText}`);
    }

    console.error("Gemini TTS Raw Response on failure:", JSON.stringify(response, null, 2));
    throw new Error("Gemini TTS API did not return audio data or a clear error message.");
};

const _attemptWithRetries = async (text: string, apiKey: string, keyName: string): Promise<string> => {
    const MAX_RETRIES = 5;
    const INITIAL_BACKOFF_MS = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await _performApiCall(text, apiKey);
        } catch (error) {
            console.error(`[${keyName}] Attempt ${attempt}/${MAX_RETRIES} for generateAudio failed. Text: "${text.substring(0,50)}..."`, error);
            
            if (error instanceof Error && error.message.includes('Audio generation blocked')) {
                throw error; // Don't retry if it's a content blocking error
            }

            if (attempt === MAX_RETRIES) {
                console.error(`[${keyName}] All retries failed.`);
                throw error; // Re-throw the last error
            }
            
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
            console.log(`Waiting ${delay}ms before next retry...`);
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error(`[${keyName}] Audio generation failed after all retries.`);
};

/**
 * Generates audio from text using the Google Gemini TTS API with a retry and fallback mechanism.
 * It attempts generation with a series of API keys in order (API_KEY, API_KEY2, API_KEY3, API_KEY4).
 * @param text The text to convert to speech.
 * @returns A promise that resolves to a local URL for the generated audio blob.
 */
export const generateAudio = async (text: string): Promise<string> => {
    const apiKeys = [
        { name: 'API_KEY', value: process.env.API_KEY },
        { name: 'API_KEY2', value: process.env.API_KEY2 },
        { name: 'API_KEY3', value: process.env.API_KEY3 },
        { name: 'API_KEY4', value: process.env.API_KEY4 },
    ].filter(key => key.value && key.value.trim() !== '');

    if (apiKeys.length === 0) {
        throw new Error("No API keys are configured (API_KEY, API_KEY2, API_KEY3, API_KEY4).");
    }

    // Ensure we don't retry with the same key if they are duplicated in env
    const uniqueApiKeys = Array.from(new Map(apiKeys.map(key => [key.value, key])).values());

    for (const apiKey of uniqueApiKeys) {
        try {
            console.log(`Attempting audio generation with ${apiKey.name}...`);
            return await _attemptWithRetries(text, apiKey.value!, apiKey.name);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Audio generation with ${apiKey.name} failed. Reason: ${errorMessage}`);
        }
    }

    console.error("Audio generation failed with all available API keys.");
    throw new Error("Audio generation failed with all available API keys.");
};
