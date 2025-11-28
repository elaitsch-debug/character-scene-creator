
export interface Character {
  id: string;
  name: string;
  imageUrl: string; // base64 data URL
  prompt: string;
}

export interface SoundEffect {
  id: string;
  name: string;
  url: string; // base64 data URL
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
}

export type ToolType = 'SCENE_BUILDER' | 'IMAGE_EDITOR' | 'VIDEO_GENERATOR' | 'CHARACTER_VOICE';

export type AspectRatio = '16:9' | '9:16';

export interface GeneratedContent {
  type: 'image' | 'video' | 'audio';
  url: string;
  characterId?: string;
  soundEffectUrl?: string;
}
