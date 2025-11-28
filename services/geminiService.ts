
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

const rotateImage = async (base64Str: string, rotation: number): Promise<string> => {
    if (!rotation) return base64Str;
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const rad = (rotation * Math.PI) / 180;
            const sin = Math.abs(Math.sin(rad));
            const cos = Math.abs(Math.cos(rad));
            canvas.width = img.width * cos + img.height * sin;
            canvas.height = img.width * sin + img.height * cos;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64Str); return; }
            
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64Str);
    });
};

export const generateScene = async (characters: Character[], scenePrompt: string, rotations?: Record<string, number>): Promise<string> => {
    const ai = getGenAI();
    
    const parts: Part[] = [];

    // Add character images
    for (const character of characters) {
        let imageUrl = character.imageUrl;
        if (rotations && rotations[character.id]) {
            imageUrl = await rotateImage(imageUrl, rotations[character.id]);
        }

        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], "character.png", { type: blob.type });
        const imagePart = await fileToGenerativePart(file);
        parts.push(imagePart);
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

    const fullPrompt = `Create a new scene featuring the character(s) from the provided image(s). ${layeringInstruction}Scene details: ${scenePrompt}. Maintain the characters' appearance and style as closely as possible.`;
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
