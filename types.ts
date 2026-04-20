
export interface Character {
  id: string;
  name: string;
  imageUrl: string; // High-res base64 data URL (loaded on demand for canvas)
  thumbnailUrl?: string; // Low-res base64 for sidebar/UI lists to save memory/storage
  prompt: string;
  jsonProfile?: any;
  version?: number;
  originalId?: string;
}

export interface SoundEffect {
  id: string;
  name: string;
  url: string; // base64 data URL
}

export type ToolType = 'SCENE_BUILDER' | 'IMAGE_GENERATOR' | 'IMAGE_EDITOR' | 'VIDEO_GENERATOR' | 'CHARACTER_VOICE' | 'ANIMATE_PICTURE' | 'JSON_PROFILER' | 'CHARACTER_EDITOR';

export type AspectRatio = '16:9' | '9:16';

export interface GeneratedContent {
  type: 'image' | 'video' | 'audio' | 'json' | 'batch';
  url: string;
  urls?: string[]; // Used for batch generation (e.g., botanic mockups)
  data?: any;
  characterId?: string;
  soundEffectUrl?: string;
}

export interface EditorState {
  originalImage: string | null;
  workingImage: string | null;
  watermarkImage: string | null; // Added watermark support
  selectedStyleId: string | null;
  lastGenerationId: string | null;
}

export interface Scene {
  id: string;
  name: string;
  characterIds: string[];
  prompt: string;
  createdAt: number;
  soundEffect?: SoundEffect;
  rotations?: Record<string, number>;
  positions?: Record<string, { x: number; y: number }>;
  generatedContent?: GeneratedContent;
}

export interface Window {
    aistudio?: {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
}
