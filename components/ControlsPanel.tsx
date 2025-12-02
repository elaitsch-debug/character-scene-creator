
import React, { useState, useCallback } from 'react';
import { AspectRatio, Character, ToolType, SoundEffect, Scene } from '../types';
import { Button } from './common/Button';
import { generateScene, editImage, generateVideo, generateCharacterSpeech } from '../services/geminiService';
import { ApiKeySelector } from './ApiKeySelector';
import { SaveIcon, VOICE_NAMES, UploadIcon, MusicIcon, TrashIcon, FilePlusIcon, ExportIcon } from '../constants';
import { fileToBase64 } from '../utils/fileUtils';

interface ControlsPanelProps {
  activeTool: ToolType;
  selectedCharacters: Character[];
  setLoading: (isLoading: boolean, message: string) => void;
  setError: (error: string | null) => void;
  onGenerationComplete: (content: { type: 'image' | 'video' | 'audio'; url: string; characterId?: string; soundEffectUrl?: string }) => void;
  
  // Scene Builder Props
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

const SceneBuilder: React.FC<Omit<ControlsPanelProps, 'activeTool'>> = ({ 
  selectedCharacters, 
  setLoading, 
  setError, 
  onGenerationComplete,
  scenePrompt,
  setScenePrompt,
  onSaveScene,
  currentSceneName,
  sceneSoundEffect,
  setSceneSoundEffect,
  soundLibrary,
  setSoundLibrary,
  characterRotations,
  onResetScene,
  scenes,
  onLoadScene,
  onExportScene
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [soundTab, setSoundTab] = useState<'SELECT' | 'UPLOAD'>('SELECT');
  const [sceneToLoad, setSceneToLoad] = useState('');

  const handleGenerate = useCallback(async () => {
    if (selectedCharacters.length === 0) {
      setError("Please select at least one character from the library.");
      return;
    }
    setLoading(true, "Building your scene...");
    setError(null);
    try {
      const imageUrl = await generateScene(selectedCharacters, scenePrompt, characterRotations);
      onGenerationComplete({ 
        type: 'image', 
        url: imageUrl, 
        soundEffectUrl: sceneSoundEffect?.url 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate scene.");
    } finally {
      setLoading(false, "");
    }
  }, [selectedCharacters, scenePrompt, setLoading, setError, onGenerationComplete, sceneSoundEffect, characterRotations]);

  const initiateSave = () => {
    if (selectedCharacters.length === 0) {
        setError("Add characters to save a scene.");
        return;
    }
    setError(null);
    // Pre-fill the name if we are editing an existing scene
    setSceneName(currentSceneName || '');
    setIsSaving(true);
  }

  const confirmSave = () => {
      if (sceneName.trim()) {
          onSaveScene(sceneName);
          setIsSaving(false);
      }
  };

  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
              const base64 = await fileToBase64(file);
              const newSound: SoundEffect = {
                  id: crypto.randomUUID(),
                  name: file.name.replace(/\.[^/.]+$/, ""),
                  url: base64
              };
              setSoundLibrary([...soundLibrary, newSound]);
              setSceneSoundEffect(newSound);
          } catch (err) {
              console.error("Audio upload failed", err);
              setError("Failed to upload audio.");
          }
      }
  };
  
  const handleLoadSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const sceneId = e.target.value;
      setSceneToLoad(sceneId);
      const scene = scenes.find(s => s.id === sceneId);
      if (scene) {
          onLoadScene(scene);
      }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Scene Builder</h2>
        <div className="flex gap-2">
           <Button onClick={onResetScene} variant="secondary" className="px-2" title="New Scene">
              <FilePlusIcon className="w-4 h-4" />
           </Button>
           <div className="relative">
              <select 
                value={sceneToLoad} 
                onChange={handleLoadSelect}
                className="bg-gray-700 text-white text-xs rounded px-2 py-2 border border-gray-600 focus:outline-none focus:border-indigo-500 max-w-[100px]"
              >
                  <option value="" disabled>Load...</option>
                  {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
           </div>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto pr-2 space-y-6">
          {/* Prompt Section */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Scene Description</label>
            <textarea
              className="w-full h-32 p-3 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500 resize-none"
              placeholder="Describe the scene setting, lighting, and action..."
              value={scenePrompt}
              onChange={(e) => setScenePrompt(e.target.value)}
            />
          </div>

          {/* Sound Effect Section */}
          <div className="space-y-2 bg-gray-800/50 p-3 rounded-lg border border-gray-700">
             <div className="flex justify-between items-center mb-2">
                 <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <MusicIcon className="w-4 h-4 text-indigo-400" />
                    Sound Effect / Ambience
                 </label>
                 {sceneSoundEffect && (
                     <button 
                        onClick={() => setSceneSoundEffect(undefined)}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                     >
                         <TrashIcon className="w-3 h-3" /> Clear
                     </button>
                 )}
             </div>
             
             {/* Sound Tabs */}
             <div className="flex gap-2 mb-2">
                 <button 
                    onClick={() => setSoundTab('SELECT')}
                    className={`flex-1 text-xs py-1 rounded ${soundTab === 'SELECT' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                 >
                     Library
                 </button>
                 <button 
                    onClick={() => setSoundTab('UPLOAD')}
                    className={`flex-1 text-xs py-1 rounded ${soundTab === 'UPLOAD' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                 >
                     Upload
                 </button>
             </div>

             {soundTab === 'SELECT' ? (
                 <select 
                    value={sceneSoundEffect?.id || ''}
                    onChange={(e) => setSceneSoundEffect(soundLibrary.find(s => s.id === e.target.value))}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                 >
                     <option value="">None selected</option>
                     {soundLibrary.map(sound => (
                         <option key={sound.id} value={sound.id}>{sound.name}</option>
                     ))}
                 </select>
             ) : (
                 <div className="border-2 border-dashed border-gray-600 rounded p-4 text-center hover:bg-gray-700/50 transition-colors cursor-pointer relative">
                     <input 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleSoundUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                     />
                     <UploadIcon className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                     <p className="text-xs text-gray-400">Click to upload audio</p>
                 </div>
             )}
             
             {sceneSoundEffect && (
                 <div className="text-xs text-indigo-300 mt-1 flex items-center gap-1">
                     <span>Selected: {sceneSoundEffect.name}</span>
                 </div>
             )}
          </div>
      </div>

      <div className="pt-4 mt-auto border-t border-gray-700 flex flex-col gap-3">
        <Button onClick={handleGenerate} className="w-full py-3 text-lg shadow-lg shadow-indigo-500/20">
          Generate Scene
        </Button>
        
        <div className="flex gap-2">
            {isSaving ? (
                <div className="flex-1 flex gap-2">
                    <input 
                        type="text" 
                        value={sceneName}
                        onChange={(e) => setSceneName(e.target.value)}
                        placeholder="Scene Name"
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 text-sm"
                        autoFocus
                    />
                    <Button onClick={confirmSave} className="px-3 py-1 text-sm">Save</Button>
                    <Button onClick={() => setIsSaving(false)} variant="secondary" className="px-3 py-1 text-sm">Cancel</Button>
                </div>
            ) : (
                <Button onClick={initiateSave} variant="secondary" className="flex-1" title="Save Scene">
                  <SaveIcon className="w-4 h-4 mr-2" /> Save Scene
                </Button>
            )}
            <Button onClick={onExportScene} variant="secondary" className="px-3" title="Export JSON">
                <ExportIcon className="w-5 h-5" />
            </Button>
        </div>
      </div>
    </div>
  );
};

const ImageEditor: React.FC<Pick<ControlsPanelProps, 'setLoading' | 'setError' | 'onGenerationComplete'>> = ({ setLoading, setError, onGenerationComplete }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [prompt, setPrompt] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleGenerate = async () => {
    if (!imageFile || !prompt) return;
    setLoading(true, "Editing image...");
    setError(null);
    try {
      const resultUrl = await editImage(imageFile, prompt);
      onGenerationComplete({ type: 'image', url: resultUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit image.");
    } finally {
      setLoading(false, "");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <h2 className="text-xl font-bold text-white">Image Editor</h2>
      
      <div className="flex-grow space-y-6">
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer relative h-48 flex items-center justify-center bg-gray-800/30">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded" />
          ) : (
             <div className="flex flex-col items-center">
                <UploadIcon className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-gray-400">Upload Image to Edit</p>
             </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Edit Instructions</label>
          <textarea
            className="w-full h-32 p-3 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500 resize-none"
            placeholder="e.g., Change the background to a futuristic city, make it night time..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
          />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={!imageFile || !prompt} className="w-full py-3">
        Generate Edit
      </Button>
    </div>
  );
};

const VideoGenerator: React.FC<Pick<ControlsPanelProps, 'setLoading' | 'setError' | 'onGenerationComplete'>> = ({ setLoading, setError, onGenerationComplete }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [keySelected, setKeySelected] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleGenerate = async () => {
    if (!imageFile || !prompt || !keySelected) return;
    setLoading(true, "Generating video...");
    setError(null);
    try {
      const videoUrl = await generateVideo(imageFile, prompt, aspectRatio, (msg) => setLoading(true, msg));
      onGenerationComplete({ type: 'video', url: videoUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate video.");
    } finally {
      setLoading(false, "");
    }
  };

  if (!keySelected) {
      return (
          <div className="flex flex-col h-full items-center justify-center p-4">
              <ApiKeySelector onKeySelected={() => setKeySelected(true)} />
          </div>
      )
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <h2 className="text-xl font-bold text-white">Video Generator</h2>
      
      <div className="flex-grow space-y-6 overflow-y-auto pr-2">
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer relative h-48 flex items-center justify-center bg-gray-800/30">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded" />
          ) : (
            <div className="flex flex-col items-center">
                <UploadIcon className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-gray-400">Upload Starting Image</p>
             </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Motion Prompt</label>
          <input
            type="text"
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500"
            placeholder="Describe the movement..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
          <div className="flex gap-4">
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`flex-1 py-2 px-4 rounded-md border ${
                aspectRatio === '16:9' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              16:9 (Landscape)
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`flex-1 py-2 px-4 rounded-md border ${
                aspectRatio === '9:16' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              9:16 (Portrait)
            </button>
          </div>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={!imageFile || !prompt} className="w-full py-3">
        Generate Video
      </Button>
    </div>
  );
};

const CharacterVoicePanel: React.FC<Pick<ControlsPanelProps, 'selectedCharacters' | 'setLoading' | 'setError' | 'onGenerationComplete'>> = ({ selectedCharacters, setLoading, setError, onGenerationComplete }) => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICE_NAMES[0]);
  const [targetCharacterId, setTargetCharacterId] = useState<string>('');
  
  // Default to first selected character if available
  React.useEffect(() => {
      if (selectedCharacters.length > 0 && !targetCharacterId) {
          setTargetCharacterId(selectedCharacters[0].id);
      }
  }, [selectedCharacters, targetCharacterId]);

  const handleGenerate = async () => {
    if (!text) return;
    setLoading(true, "Generating speech...");
    setError(null);
    try {
      const audioUrl = await generateCharacterSpeech(text, selectedVoice);
      onGenerationComplete({ 
          type: 'audio', 
          url: audioUrl,
          characterId: targetCharacterId || undefined
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate speech.");
    } finally {
      setLoading(false, "");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <h2 className="text-xl font-bold text-white">Character Voice</h2>
      
      <div className="flex-grow space-y-6">
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Character (Optional)</label>
            <select
                value={targetCharacterId}
                onChange={(e) => setTargetCharacterId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
                <option value="">-- No Specific Character --</option>
                {selectedCharacters.map(char => (
                    <option key={char.id} value={char.id}>{char.name}</option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Select a character to display their visual with the audio.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Spoken Text</label>
          <textarea
            className="w-full h-40 p-3 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500 resize-none"
            placeholder="Enter what the character should say..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Voice Style</label>
          <div className="grid grid-cols-2 gap-2">
            {VOICE_NAMES.map(voice => (
              <button
                key={voice}
                onClick={() => setSelectedVoice(voice)}
                className={`py-2 px-3 rounded-md text-sm border transition-colors ${
                  selectedVoice === voice
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {voice}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={!text} className="w-full py-3">
        Generate Speech
      </Button>
    </div>
  );
};

export const ControlsPanel: React.FC<ControlsPanelProps> = (props) => {
  const { activeTool, ...rest } = props;

  return (
    <aside className="w-96 bg-gray-900 border-l border-gray-700 p-6 flex flex-col shadow-xl z-20 overflow-hidden">
      {activeTool === 'SCENE_BUILDER' && <SceneBuilder {...rest} />}
      {activeTool === 'IMAGE_EDITOR' && (
        <ImageEditor 
            setLoading={rest.setLoading} 
            setError={rest.setError} 
            onGenerationComplete={rest.onGenerationComplete} 
        />
      )}
      {activeTool === 'VIDEO_GENERATOR' && (
        <VideoGenerator 
            setLoading={rest.setLoading} 
            setError={rest.setError} 
            onGenerationComplete={rest.onGenerationComplete} 
        />
      )}
      {activeTool === 'CHARACTER_VOICE' && (
        <CharacterVoicePanel 
            selectedCharacters={rest.selectedCharacters}
            setLoading={rest.setLoading} 
            setError={rest.setError} 
            onGenerationComplete={rest.onGenerationComplete} 
        />
      )}
    </aside>
  );
};
