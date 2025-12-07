
import { GoogleGenAI, Modality, Part } from "@google/genai";
import { MODEL_NAMES } from '../constants';
// Fix: Import `fileToBase64` to resolve a reference error in the `generateVideo` function.
import { fileToGenerativePart, fileToBase64 } from '../utils/fileUtils';
import { base64ToUint8Array, createWavBlob } from '../utils/audioUtils';
import { AspectRatio, Character } from '../types';

// Fix: Removed global type declaration for window.aistudio. It has been moved to types.ts to resolve a conflict.

const getGenAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const generateCharacterDescription = async (imageFile: File): Promise<string> => {
  const ai = getGenAI();
  const imagePart = await fileToGenerativePart(imageFile);
  const textPart = { text: "Describe the character in this image in detail for a character design sheet. Focus on visual traits like hair, eyes, clothing, style, and key features. The description will be used to generate new images of this character." };
  
  const response = await ai.models.generateContent({
    model: MODEL_NAMES.DESCRIPTION_GENERATION,
    contents: { parts: [imagePart, textPart] },
  });
  
  return response.text || '';
};

export const generateCharacterImage = async (prompt: string): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateImages({
    model: MODEL_NAMES.IMAGE_GENERATION,
    prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '1:1',
    },
  });

  if (response.generatedImages && response.generatedImages.length > 0) {
    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  }
  throw new Error("Image generation failed.");
};

export const generateImageFromInput = async (input: string, onProgress?: (message: string) => void): Promise<string> => {
  const ai = getGenAI();
  let prompt = input;
  let outputMimeType = 'image/jpeg';

  try {
    const json = JSON.parse(input);
    if (json.prompt) {
      prompt = json.prompt;
      if (json.transparent_background) {
         prompt += ", transparent background";
         outputMimeType = 'image/png';
      }
      if (json.progression_text && onProgress) {
          onProgress(json.progression_text);
      }
    }
  } catch (e) {
    // Input is not JSON, treat as raw text prompt
  }

  const response = await ai.models.generateImages({
    model: MODEL_NAMES.IMAGE_GENERATION,
    prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: outputMimeType,
      aspectRatio: '1:1',
    },
  });

  if (response.generatedImages && response.generatedImages.length > 0) {
    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:${outputMimeType};base64,${base64ImageBytes}`;
  }
  throw new Error("Image generation failed.");
};

/**
 * Resizes and rotates a base64 image.
 * Resizing to a smaller dimension (default 512px) ensures we can send multiple characters (up to 20)
 * without hitting API payload limits.
 */
const processCharacterImage = async (base64Str: string, rotation: number = 0, maxSize: number = 512): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Calculate dimensions
            let width = img.width;
            let height = img.height;

            // Resize logic (maintain aspect ratio)
            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width = width * ratio;
                height = height * ratio;
            }

            // Rotation dimension calculation
            const rad = (rotation * Math.PI) / 180;
            const sin = Math.abs(Math.sin(rad));
            const cos = Math.abs(Math.cos(rad));
            
            // Canvas size must accommodate the rotated image
            canvas.width = width * cos + height * sin;
            canvas.height = width * sin + height * cos;

            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64Str); return; }

            // High quality scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);
            // Draw resized image centered
            ctx.drawImage(img, -width / 2, -height / 2, width, height);

            // Export as PNG to preserve transparency if present
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64Str);
    });
};

export const generateScene = async (characters: Character[], scenePrompt: string, rotations?: Record<string, number>, onProgress?: (message: string) => void): Promise<string> => {
    const ai = getGenAI();
    
    // Parse scenePrompt for JSON Context Profile
    let finalPrompt = scenePrompt;
    let explicitTransparent = false;
    
    try {
        const json = JSON.parse(scenePrompt);
        if (json.prompt) {
            finalPrompt = json.prompt;
            if (json.transparent_background) {
                explicitTransparent = true;
            }
            if (json.progression_text && onProgress) {
                onProgress(json.progression_text);
            }
        }
    } catch (e) {
        // Not JSON, use original string
    }
    
    const parts: Part[] = [];

    // Add character images
    for (const character of characters) {
        let imageUrl = character.imageUrl;
        
        // Process image: Apply rotation and resize to max 512px to optimize payload size
        // This allows supporting up to 20 characters in a single request.
        imageUrl = await processCharacterImage(imageUrl, rotations?.[character.id] || 0, 512);

        // Extract base64 data and mimeType directly from the data URL
        const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType,
                },
            });
        }
    }
    
    // Add layering instructions to the prompt
    let layeringInstruction = '';
    if (characters.length > 1) {
        // Array is ordered from back to front.
        const layerDescriptions = characters.map((char, index) => {
            if (index === 0) return `${char.name} is in the background`;
            if (index === characters.length - 1) return `${char.name} is in the foreground`;
            return `${char.name} is behind ${characters[index + 1].name} and in front of ${characters[index - 1].name}`;
        }).join('. ');
        layeringInstruction = `Pay close attention to the layering: ${layerDescriptions}. `;
    }

    let fullPrompt = `Create a new scene featuring the ${characters.length} character(s) from the provided image(s). ${layeringInstruction}Scene details: ${finalPrompt}. Maintain the characters' appearance and style as closely as possible.`;
    
    if (explicitTransparent) {
        fullPrompt += " The background should be transparent or solid white to easily isolate the subjects.";
    }

    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
        model: MODEL_NAMES.IMAGE_EDITING,
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }

    throw new Error("Scene generation failed to produce an image.");
};

export const editImage = async (imageFile: File, prompt: string): Promise<string> => {
    const ai = getGenAI();
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: MODEL_NAMES.IMAGE_EDITING,
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("Image editing failed to produce an image.");
};

export const generateCharacterSpeech = async (text: string, voiceName: string): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: MODEL_NAMES.TTS,
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate audio.");
  }

  // Convert raw PCM to WAV blob
  const pcmData = base64ToUint8Array(base64Audio);
  const wavBlob = createWavBlob(pcmData);
  
  return URL.createObjectURL(wavBlob);
};


export const generateVideo = async (
    imageFile: File,
    prompt: string,
    aspectRatio: AspectRatio,
    onProgress: (message: string) => void
): Promise<string> => {
    onProgress("Initializing video generation...");
    // Create a new instance right before the call to ensure the latest key is used.
    const ai = getGenAI();

    let operation = await ai.models.generateVideos({
        model: MODEL_NAMES.VIDEO_GENERATION,
        prompt,
        image: {
            imageBytes: (await fileToBase64(imageFile)).split(',')[1],
            mimeType: imageFile.type,
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    });

    const progressMessages = [
      "Summoning digital muses...",
      "Warming up the pixels...",
      "Choreographing the animation...",
      "Rendering the first frames...",
      "Almost there, adding the final sparkle...",
    ];
    let messageIndex = 0;

    while (!operation.done) {
        onProgress(progressMessages[messageIndex % progressMessages.length]);
        messageIndex++;
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    
    onProgress("Finalizing video...");
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation did not return a valid link.");
    }
    
    // The response.body contains the MP4 bytes. You must append an API key when fetching from the download link.
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};
