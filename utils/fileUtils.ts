
import { Part } from "@google/genai";

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedData = await fileToBase64(file);
    const base64Data = base64EncodedData.split(',')[1];
    
    return {
      inlineData: {
        data: base64Data,
        mimeType: file.type,
      },
    };
};
