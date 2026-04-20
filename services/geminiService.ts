
import { GoogleGenAI, Modality, Part, Type } from "@google/genai";
import { MODEL_NAMES, CHARACTER_STYLES } from '../constants';
import { fileToGenerativePart, fileToBase64 } from '../utils/fileUtils';
import { base64ToUint8Array, createWavBlob } from '../utils/audioUtils';
import { AspectRatio, Character } from '../types';

const getGenAI = () => {
  const provider = localStorage.getItem('css_api_provider') || 'gemini';
  const geminiKey = localStorage.getItem('css_gemini_key');
  const vertexKey = localStorage.getItem('css_vertex_key');

  let activeKey = process.env.API_KEY;

  if (provider === 'gemini' && geminiKey) {
    activeKey = geminiKey;
  } else if (provider === 'vertex' && vertexKey) {
    activeKey = vertexKey;
  }

  if (!activeKey) {
    throw new Error("API_KEY not configured. Please set it in Settings or environment variables.");
  }
  
  return new GoogleGenAI({ apiKey: activeKey });
}

/**
 * Resilient Request Wrapper
 */
async function resilientRequest<T>(
  requestFn: () => Promise<T>,
  onRetry?: (attempt: number, error: string) => void,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message?.toLowerCase() || "";
      
      // Handle missing entity (often unpaid key or invalid project)
      if (errorMsg.includes("requested entity was not found")) {
         throw new Error("API_KEY_REQUIRED");
      }

      const isTransient = errorMsg.includes("503") || 
                          errorMsg.includes("429") || 
                          errorMsg.includes("deadline") ||
                          errorMsg.includes("expired") ||
                          errorMsg.includes("failed to fetch");

      if (isTransient && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        if (onRetry) onRetry(attempt, error.message || "Transient error");
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Uses AI to isolate the subject of an image on a plain white background
 */
export const isolateWatermark = async (imageSource: string): Promise<string> => {
  const ai = getGenAI();
  const matches = imageSource.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid image source for isolation");
  
  const imagePart = {
    inlineData: {
      data: matches[2],
      mimeType: matches[1]
    }
  };

  const prompt = "TASK: Isolate the main subject of this image. Return ONLY the subject perfectly centered on a PURE WHITE (#FFFFFF) background. Remove all shadows, distractions, and existing backgrounds. High-fidelity output required.";

  return resilientRequest(async () => {
    const aiInstance = getGenAI();
    const response = await aiInstance.models.generateContent({
      model: MODEL_NAMES.IMAGE_EDITING,
      contents: { parts: [imagePart, { text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Could not extract isolated subject from response.");
  });
};

/**
 * Programmatically applies 10 watermark instances along a path.
 */
export const applyMultiWatermark = (base64Image: string, watermarkBase64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const mainImg = new Image();
    mainImg.crossOrigin = "anonymous";
    mainImg.onload = () => {
      const wmImg = new Image();
      wmImg.crossOrigin = "anonymous";
      wmImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = mainImg.width;
        canvas.height = mainImg.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("Could not get canvas context");

        const wmCanvas = document.createElement('canvas');
        wmCanvas.width = wmImg.width;
        wmCanvas.height = wmImg.height;
        const wmCtx = wmCanvas.getContext('2d');
        if (!wmCtx) return reject("Could not get watermark context");
        wmCtx.drawImage(wmImg, 0, 0);
        
        const wmImageData = wmCtx.getImageData(0, 0, wmCanvas.width, wmCanvas.height);
        const data = wmImageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; 
          }
        }
        wmCtx.putImageData(wmImageData, 0, 0);

        ctx.drawImage(mainImg, 0, 0);

        const count = 10;
        const centerZone = {
          x: canvas.width * 0.3,
          y: canvas.height * 0.3,
          w: canvas.width * 0.4,
          h: canvas.height * 0.4
        };

        for (let i = 0; i < count; i++) {
          const progress = i / (count - 1);
          const wmWidth = canvas.width * (0.25 + Math.random() * 0.05);
          const wmHeight = (wmImg.height / wmImg.width) * wmWidth;

          let x = (canvas.width - wmWidth) * progress + (Math.random() - 0.5) * (canvas.width * 0.2);
          let y = (canvas.height - wmHeight) * progress + (Math.random() - 0.5) * (canvas.height * 0.2);

          x = Math.max(0, Math.min(x, canvas.width - wmWidth));
          y = Math.max(0, Math.min(y, canvas.height - wmHeight));

          if (x + wmWidth > centerZone.x && x < centerZone.x + centerZone.w &&
              y + wmHeight > centerZone.y && y < centerZone.y + centerZone.h) {
             if (x + wmWidth / 2 < canvas.width / 2) x -= wmWidth * 0.5;
             else x += wmWidth * 0.5;
             if (y + wmHeight / 2 < canvas.height / 2) y -= wmHeight * 0.5;
             else y += wmHeight * 0.5;
          }

          x = Math.max(0, Math.min(x, canvas.width - wmWidth));
          y = Math.max(0, Math.min(y, canvas.height - wmHeight));

          const rotation = (Math.random() * 20 - 10) * (Math.PI / 180);
          const opacity = 0.20 + Math.random() * 0.10;

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.translate(x + wmWidth / 2, y + wmHeight / 2);
          ctx.rotate(rotation);
          ctx.drawImage(wmCanvas, -wmWidth / 2, -wmHeight / 2, wmWidth, wmHeight);
          ctx.restore();
        }

        resolve(canvas.toDataURL('image/png', 1.0));
      };
      wmImg.onerror = reject;
      wmImg.src = watermarkBase64;
    };
    mainImg.onerror = reject;
    mainImg.src = base64Image;
  });
};

export const transformImageWithAI = async (
  imageFile: File,
  userPrompt: string,
  jsonContext?: string,
  onProgress?: (msg: string) => void
): Promise<string> => {
  const imagePart = await fileToGenerativePart(imageFile);
  const finalPrompt = `PRO TASK: High-Resolution Visual Transformation. Ensure modern aesthetics and crisp textures. USER REQUEST: ${userPrompt}`;

  return resilientRequest(async () => {
    const aiInstance = getGenAI();
    const response = await aiInstance.models.generateContent({
      model: MODEL_NAMES.IMAGE_EDITING,
      contents: { parts: [imagePart, { text: finalPrompt }] },
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Transformation returned no visual data.");
  });
};

export const generateBotanicMockups = async (
  imageFile: File,
  watermarkSource: string,
  onProgress?: (msg: string) => void
): Promise<string[]> => {
  const imagePart = await fileToGenerativePart(imageFile);
  const variations = [
    { prompt: "Botanical line art print in a white frame, Scandinavian minimalist living room." },
    { prompt: "Botanical line art framed print on a warm beige wall, cozy interior styling." },
    { prompt: "Botanical line art print in a light oak frame, serene bedroom wall." }
  ];

  const results: string[] = [];
  for (let i = 0; i < variations.length; i++) {
    if (onProgress) onProgress(`Generating Botanic Scene ${i + 1} of ${variations.length}...`);
    const pair = await resilientRequest(async () => {
      const aiInstance = getGenAI();
      const response = await aiInstance.models.generateContent({
        model: MODEL_NAMES.IMAGE_EDITING,
        contents: { parts: [imagePart, { text: variations[i].prompt }] },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
      });

      if (response.candidates[0].finishReason === 'SAFETY') {
         throw new Error("Variation blocked by safety filters.");
      }

      let primaryUrl: string | null = null;
      for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
              primaryUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
          }
      }

      if (!primaryUrl) throw new Error("No image data in model response.");
      
      const watermarkedUrl = await applyMultiWatermark(primaryUrl, watermarkSource);
      return [primaryUrl, watermarkedUrl];
    });
    results.push(...pair);
  }
  return results;
};

export const generateStandardScenes = async (
  imageFile: File,
  watermarkSource: string,
  onProgress?: (msg: string) => void
): Promise<string[]> => {
  const imagePart = await fileToGenerativePart(imageFile);
  const masterprompt = "High-resolution lifestyle mockup featuring a framed minimalist line-art print of the Cologne Cathedral with the bold typography ‘Home is where the Dom is’. Clean, crisp lighting, natural shadows, premium interior styling, soft depth of field, realistic textures, no reflections on glass, artwork centered and clearly visible, modern aesthetic, warm inviting atmosphere, professional Etsy product photography.";
  
  const variations = [
    { prompt: "Three frames of different sizes (8x10, 11x14, 16x20) hanging together on a wall, showing scale. The provided artwork is placed inside all three frames." },
    { prompt: masterprompt },
    { prompt: "Framed Cologne Cathedral line-art print with ‘Home is where the Dom is’ hanging above a light oak sideboard in a bright Scandinavian living room, white walls, soft natural daylight, neutral tones, cozy minimalism, plants and ceramics for styling, clean shadows, premium Etsy mockup." },
    { prompt: "Framed Cologne Cathedral print with elegant typography hanging above a neatly made bed in a calm neutral bedroom, linen fabrics, soft morning light, gentle shadows, serene atmosphere, premium Etsy mockup style." },
    { prompt: "Cologne Cathedral typography print framed and placed on a floating shelf in a modern cozy kitchen, warm wooden textures, ceramic mugs, herbs, soft window light, inviting home feeling, realistic Etsy product mockup." },
    { prompt: "Framed Cologne Cathedral line-art print standing on a desk in a stylish home office, laptop, stationery, soft daylight, clean minimal workspace, motivational aesthetic, crisp textures, Etsy-ready mockup." },
    { prompt: "Framed Cologne Cathedral typography artwork displayed on a textured wall inside a cozy café, warm ambient lighting, wooden tables, subtle bokeh, inviting atmosphere, lifestyle Etsy mockup." },
    { prompt: "Cologne Cathedral line-art print in a wooden frame hanging on a rustic farmhouse wall, warm sunlight, natural textures, dried flowers, cozy homestead feeling, high-quality Etsy mockup." },
    { prompt: "Framed Cologne Cathedral typography print as part of a curated gallery wall with neutral abstract art, white wall, balanced composition, soft shadows, modern minimalist interior, professional Etsy mockup." },
    { prompt: "Large framed Cologne Cathedral typography print displayed on a raw concrete wall in a modern industrial loft, metal accents, warm Edison lighting, leather sofa, urban atmosphere, high-contrast textures, stylish Etsy mockup." },
    { prompt: "Minimalist hallway scene with a framed Cologne Cathedral line-art print above a narrow console table, soft warm lighting, natural wood, small decorative bowl and keys, welcoming home vibe, clean Etsy mockup aesthetic." }
  ];

  const results: string[] = [];
  for (let i = 0; i < variations.length; i++) {
    if (onProgress) onProgress(`Generating Standard Scene ${i + 1} of ${variations.length}...`);
    const pair = await resilientRequest(async () => {
      const aiInstance = getGenAI();
      const response = await aiInstance.models.generateContent({
        model: MODEL_NAMES.IMAGE_EDITING,
        contents: { parts: [imagePart, { text: variations[i].prompt }] },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
      });

      if (response.candidates[0].finishReason === 'SAFETY') {
         throw new Error(`Scene ${i + 1} blocked by safety filters.`);
      }

      let primaryUrl: string | null = null;
      for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
              primaryUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
          }
      }

      if (!primaryUrl) throw new Error(`Variation ${i + 1} returned no image.`);
      
      const watermarkedUrl = await applyMultiWatermark(primaryUrl, watermarkSource);
      return [primaryUrl, watermarkedUrl];
    });
    results.push(...pair);
  }
  return results;
};

export const generateRandomName = async (style?: string): Promise<string> => {
  const ai = getGenAI();
  const prompt = `Generate a cool fitting name for a ${style || 'general'} character. Return ONLY the name.`;
  const response = await ai.models.generateContent({ model: MODEL_NAMES.ANALYSIS, contents: prompt });
  return response.text?.trim() || "Unnamed Character";
};

export const generateCharacterWithStyle = async (name: string, desc: string, style?: string): Promise<any> => {
  const fullPrompt = `Character Name: ${name}. Description: ${desc}. Style: ${style || 'Modern character design sheet'}. Isolated on white.`;
  return resilientRequest(async () => {
    const aiInstance = getGenAI();
    const response = await aiInstance.models.generateContent({
      model: MODEL_NAMES.IMAGE_EDITING,
      contents: { parts: [{ text: fullPrompt }] },
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return { image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, metadata: { appliedStyle: style } };
    }
    throw new Error("Character generation failed.");
  });
};

export const generateCharacterDescription = async (imageFile: File): Promise<string> => {
  const ai = getGenAI();
  const imagePart = await fileToGenerativePart(imageFile);
  const response = await ai.models.generateContent({
    model: MODEL_NAMES.DESCRIPTION_GENERATION,
    contents: { parts: [imagePart, { text: "Describe this character in detail." }] },
  });
  return response.text || '';
};

export const generateJsonContextProfile = async (imageFile: File): Promise<any> => {
  const ai = getGenAI();
  const imagePart = await fileToGenerativePart(imageFile);
  const response = await ai.models.generateContent({
    model: MODEL_NAMES.ANALYSIS,
    contents: { parts: [imagePart, { text: "Extract character visual data as JSON." }] },
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};

export const generateCharacterFromJson = async (json: any): Promise<any> => {
  const prompt = `Create a character from this profile: ${JSON.stringify(json)}`;
  return generateCharacterWithStyle("New Character", prompt);
};

export const generateCharacterDirectly = async (file: File): Promise<any> => {
  const desc = await generateCharacterDescription(file);
  const json = await generateJsonContextProfile(file);
  const res = await generateCharacterWithStyle("Direct Result", desc);
  return { url: res.image, prompt: desc, json };
};

export const refineCharacter = async (char: Character, json: any, instructions: string): Promise<string> => {
  const matches = char.imageUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid URL");
  const prompt = `Refine: ${instructions}. Context: ${JSON.stringify(json)}. Keep character identity. White background.`;
  return resilientRequest(async () => {
    const aiInstance = getGenAI();
    const response = await aiInstance.models.generateContent({
      model: MODEL_NAMES.IMAGE_EDITING,
      contents: { parts: [{ inlineData: { data: matches[2], mimeType: matches[1] } }, { text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Refinement failed.");
  });
};

export const generateScene = async (chars: Character[], prompt: string, rotations: Record<string, number>, onProgress: any): Promise<string> => {
  const parts: Part[] = chars.map((c): Part | null => {
    const m = c.imageUrl.match(/^data:(.+);base64,(.+)$/);
    return m ? { inlineData: { data: m[2], mimeType: m[1] } } : null;
  }).filter((p): p is Part => p !== null);
  parts.push({ text: `Create cinematic scene: ${prompt}` });
  return resilientRequest(async () => {
    const aiInstance = getGenAI();
    const response = await aiInstance.models.generateContent({ 
        model: MODEL_NAMES.IMAGE_EDITING, 
        contents: { parts },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("Scene generation failed.");
  });
};

export const generateVideo = async (file: File, prompt: string, ratio: AspectRatio, onProgress: any): Promise<string> => {
  const b64 = await fileToBase64(file);
  const data = b64.split(',')[1];
  let ai = getGenAI();
  let operation = await ai.models.generateVideos({
    model: MODEL_NAMES.VIDEO_GENERATION,
    prompt,
    image: { imageBytes: data, mimeType: file.type },
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: ratio }
  });
  while (!operation.done) {
    await new Promise(r => setTimeout(r, 10000));
    ai = getGenAI();
    operation = await ai.operations.getVideosOperation({ operation });
  }
  const link = operation.response?.generatedVideos?.[0]?.video?.uri;
  const res = await fetch(`${link}&key=${process.env.API_KEY}`);
  return URL.createObjectURL(await res.blob());
};

export const generateCharacterSpeech = async (text: string, voice: string): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: MODEL_NAMES.TTS,
    contents: [{ parts: [{ text }] }],
    config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
  });
  const b64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("Speech failed.");
  return URL.createObjectURL(createWavBlob(base64ToUint8Array(b64)));
};

export const generateImageFromInput = async (input: string, onProgress: any): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateImages({
    model: MODEL_NAMES.IMAGE_GENERATION,
    prompt: input,
    config: { numberOfImages: 1, aspectRatio: "1:1" }
  });
  if (response.generatedImages?.[0]) return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
  throw new Error("Image generation failed.");
};

export const animateImage = async (file: File, input: string, ratio: AspectRatio, onProgress: any): Promise<string> => {
  return generateVideo(file, input, ratio, onProgress);
};
