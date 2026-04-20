
import React, { useState, useCallback, useEffect } from 'react';
import { AspectRatio, Character, ToolType, SoundEffect, Scene, EditorState } from '../types';
import { Button } from './common/Button';
import { 
  generateScene, 
  generateVideo, 
  generateCharacterSpeech, 
  generateImageFromInput, 
  animateImage, 
  generateJsonContextProfile, 
  generateCharacterFromJson, 
  generateCharacterDirectly, 
  refineCharacter, 
  generateRandomName,
  transformImageWithAI,
  applyMultiWatermark,
  isolateWatermark,
  generateBotanicMockups,
  generateStandardScenes
} from '../services/geminiService';
import { ApiKeySelector } from './ApiKeySelector';
import { 
  SaveIcon, 
  VOICE_NAMES, 
  UploadIcon, 
  MusicIcon, 
  TrashIcon, 
  FilePlusIcon, 
  ExportIcon, 
  PhotoIcon, 
  SparklesIcon, 
  CodeBracketIcon, 
  AddUserIcon, 
  STYLE_ENGINE, 
  DownloadIcon,
  MicrophoneIcon
} from '../constants';
import { fileToBase64, compressImage } from '../utils/fileUtils';

interface ControlsPanelProps {
  activeTool: ToolType;
  selectedCharacters: Character[];
  characters: Character[];
  setLoading: (isLoading: boolean, message: string) => void;
  setError: (error: string | null) => void;
  onGenerationComplete: (content: { type: 'image' | 'video' | 'audio' | 'json' | 'batch'; url: string; urls?: string[]; data?: any; characterId?: string; soundEffectUrl?: string }) => void;
  onSaveCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  
  editorState: EditorState;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;

  scenePrompt: string;
  setScenePrompt: (prompt: string) => void;
  onSaveScene: (name: string) => void;
  currentSceneName?: string;
  sceneSoundEffect: SoundEffect | undefined;
  setSceneSoundEffect: (sound: SoundEffect | undefined) => void;
  soundLibrary: SoundEffect[];
  setSoundLibrary: (library: SoundEffect[]) => void;
  characterRotations: Record<string, number>;
  onResetScene: () => void;
  scenes: Scene[];
  onLoadScene: (scene: Scene) => void;
  onExportScene: () => void;
}

const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

const CharacterVoicePanel: React.FC<Pick<ControlsPanelProps, 'selectedCharacters' | 'setLoading' | 'setError' | 'onGenerationComplete'>> = ({ selectedCharacters, setLoading, setError, onGenerationComplete }) => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICE_NAMES[0]);
  const [targetCharacterId, setTargetCharacterId] = useState<string>('');
  useEffect(() => {
      if (selectedCharacters.length > 0 && !targetCharacterId) setTargetCharacterId(selectedCharacters[0].id);
  }, [selectedCharacters, targetCharacterId]);
  const handleGenerate = async () => {
    if (!text) return;
    setLoading(true, "Generating speech...");
    setError(null);
    try {
      const audioUrl = await generateCharacterSpeech(text, selectedVoice);
      onGenerationComplete({ type: 'audio', url: audioUrl, characterId: targetCharacterId || undefined });
    } catch (err: any) {
      setError(err.message || "Failed to generate speech.");
    } finally {
      setLoading(false, "");
    }
  };
  return (
    <div className="flex flex-col h-full space-y-6">
      <h2 className="text-xl font-bold text-white flex items-center gap-2"><MicrophoneIcon className="w-6 h-6" /> Character Voice</h2>
      <div className="flex-grow space-y-6">
        <div><label className="block text-xs font-bold text-gray-400 mb-2">Character</label><select value={targetCharacterId} onChange={(e) => setTargetCharacterId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-md p-3 text-white"><option value="">-- Generic --</option>{selectedCharacters.map(char => (<option key={char.id} value={char.id}>{char.name}</option>))}</select></div>
        <div><label className="block text-xs font-bold text-gray-400 mb-2">Text to Voice</label><textarea className="w-full h-40 p-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-600 resize-none" placeholder="Enter text..." value={text} onChange={(e) => setText(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">{VOICE_NAMES.map(voice => (<button key={voice} onClick={() => setSelectedVoice(voice)} className={`py-2 px-3 rounded text-xs border transition-colors ${selectedVoice === voice ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>{voice}</button>))}</div>
      </div>
      <Button onClick={handleGenerate} disabled={!text} className="w-full py-3">Generate Spoken Audio</Button>
    </div>
  );
};

const ImageEditor: React.FC<Pick<ControlsPanelProps, 'setLoading' | 'setError' | 'onGenerationComplete' | 'editorState' | 'setEditorState'>> = ({ setLoading, setError, onGenerationComplete, editorState, setEditorState }) => {
  const [prompt, setPrompt] = useState('');
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      setEditorState(prev => ({ ...prev, originalImage: base64, workingImage: base64 }));
    }
  };

  const handleWatermarkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 400, 0.8);
      setEditorState(prev => ({ ...prev, watermarkImage: compressed }));
    }
  };

  const handleApplyPrompt = async () => {
    if (!editorState.originalImage || !prompt.trim()) return;
    setLoading(true, "Processing AI modification...");
    setError(null);
    try {
      const artFile = dataURLtoFile(editorState.originalImage, "art.png");
      const resultUrl = await transformImageWithAI(artFile, prompt, undefined, (msg) => setLoading(true, msg));
      setEditorState(prev => ({ ...prev, workingImage: resultUrl }));
      onGenerationComplete({ type: 'image', url: resultUrl });
    } catch (err: any) {
      if (err.message === "API_KEY_REQUIRED") {
         await handleKeySelection();
      } else {
         setError(err.message || "Modification failed.");
      }
    } finally {
      setLoading(false, "");
    }
  };

  const handleKeySelection = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      alert("A paid API key is required for high-resolution Pro features. Please select one in the following dialog.");
      await window.aistudio.openSelectKey();
    }
  };

  const processMockups = async (type: 'botanic' | 'standard') => {
    if (!editorState.originalImage) return;
    setLoading(true, "Preparing assets...");
    setError(null);
    try {
      const artFile = dataURLtoFile(editorState.originalImage, "art.png");
      const rawSource = editorState.watermarkImage || editorState.originalImage!;
      
      setLoading(true, "Isolating watermark...");
      const isolatedWM = await isolateWatermark(rawSource);

      setLoading(true, `Starting ${type} generation...`);
      let urls: string[] = [];
      if (type === 'botanic') {
          urls = await generateBotanicMockups(artFile, isolatedWM, (msg) => setLoading(true, msg));
      } else if (type === 'standard') {
          urls = await generateStandardScenes(artFile, isolatedWM, (msg) => setLoading(true, msg));
      }

      onGenerationComplete({ type: 'batch', url: urls[0], urls });
    } catch (err: any) {
      if (err.message === "API_KEY_REQUIRED") {
         await handleKeySelection();
      } else {
         console.error("Mockup Error:", err);
         setError(err.message || "Batch generation failed.");
      }
    } finally {
      setLoading(false, "");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2"><SparklesIcon className="w-6 h-6" /> Image Editor</h2>
      <div className="flex-grow space-y-4 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 text-center">
                <label className="block text-[10px] font-bold uppercase text-gray-500">Editor Picture</label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-2 h-24 flex items-center justify-center relative bg-gray-800/30 overflow-hidden">
                  <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  {editorState.originalImage ? <img src={editorState.originalImage} className="max-h-full object-contain" /> : <UploadIcon className="w-6 h-6 text-gray-500" />}
                </div>
            </div>
            <div className="space-y-1 text-center">
                <label className="block text-[10px] font-bold uppercase text-gray-500">Watermark Picture</label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-2 h-24 flex items-center justify-center relative bg-gray-800/30 overflow-hidden">
                  <input type="file" accept="image/*" onChange={handleWatermarkFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  {editorState.watermarkImage ? <img src={editorState.watermarkImage} className="max-h-full object-contain" /> : <UploadIcon className="w-6 h-6 text-gray-500" />}
                </div>
            </div>
        </div>
        <textarea className="w-full h-24 p-3 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-600 resize-none focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Enter modification instructions..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleApplyPrompt} className="w-full text-xs py-3 shadow-lg shadow-indigo-900/20">Apply AI Edit</Button>
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => processMockups('botanic')} className="bg-emerald-700 hover:bg-emerald-600 text-[10px] py-3 uppercase font-black tracking-tighter">Botanic Line Art</Button>
                    <Button onClick={() => processMockups('standard')} className="bg-indigo-600 hover:bg-indigo-500 text-[10px] py-3 uppercase font-black tracking-tighter shadow-lg shadow-indigo-500/10">Standard Scenes</Button>
                </div>
            </div>
        </div>
        <p className="text-[9px] text-gray-500 italic text-center">Batch generation (11 scenes) requires a Pro API key for high-resolution results.</p>
      </div>
    </div>
  );
};

// Structural Placeholders
const SceneBuilder: React.FC<any> = () => null;
const JSONProfilerPanel: React.FC<any> = () => null;
const CharacterEditorPanel: React.FC<any> = () => null;
const ImageGeneratorPanel: React.FC<any> = () => null;
const AnimatePicturePanel: React.FC<any> = () => null;
const VideoGenerator: React.FC<any> = () => null;

export const ControlsPanel: React.FC<ControlsPanelProps> = (props) => {
  const { activeTool, ...rest } = props;
  return (
    <aside className="w-96 flex-shrink-0 bg-gray-900 border-l border-gray-700 p-6 flex flex-col shadow-xl z-20 overflow-hidden">
      {activeTool === 'SCENE_BUILDER' && <SceneBuilder {...rest} />}
      {activeTool === 'JSON_PROFILER' && <JSONProfilerPanel {...rest} />}
      {activeTool === 'CHARACTER_EDITOR' && <CharacterEditorPanel {...rest} />}
      {activeTool === 'IMAGE_GENERATOR' && <ImageGeneratorPanel {...rest} />}
      {activeTool === 'ANIMATE_PICTURE' && <AnimatePicturePanel {...rest} />}
      {activeTool === 'IMAGE_EDITOR' && <ImageEditor setLoading={rest.setLoading} setError={rest.setError} onGenerationComplete={rest.onGenerationComplete} editorState={rest.editorState} setEditorState={rest.setEditorState} />}
      {activeTool === 'VIDEO_GENERATOR' && <VideoGenerator {...rest} />}
      {activeTool === 'CHARACTER_VOICE' && <CharacterVoicePanel selectedCharacters={rest.selectedCharacters} setLoading={rest.setLoading} setError={rest.setError} onGenerationComplete={rest.onGenerationComplete} />}
    </aside>
  );
};
