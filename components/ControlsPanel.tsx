
import React, { useState, useCallback } from 'react';
import { AspectRatio, Character, ToolType, SoundEffect } from '../types';
import { Button } from './common/Button';
import { generateScene, editImage, generateVideo, generateCharacterSpeech } from '../services/geminiService';
import { ApiKeySelector } from './ApiKeySelector';
import { SaveIcon, VOICE_NAMES, UploadIcon, MusicIcon, TrashIcon } from '../constants';
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
  sceneSoundEffect: SoundEffect | undefined;
  setSceneSoundEffect: (sound: SoundEffect | undefined) => void;
  soundLibrary: SoundEffect[];
  setSoundLibrary: (library: SoundEffect[]) => void;
  characterRotations: Record<string, number>;
}

const SceneBuilder: React.FC<Omit<ControlsPanelProps, 'activeTool'>> = ({ 
  selectedCharacters, 
  setLoading, 
  setError, 
  onGenerationComplete,
  scenePrompt,
  setScenePrompt,
  onSaveScene,
  sceneSoundEffect,
  setSceneSoundEffect,
  soundLibrary,
  setSoundLibrary,
  characterRotations
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [soundTab, setSoundTab] = useState<'SELECT' | 'UPLOAD'>('SELECT');

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
    setIsSaving(true);
  }

  const confirmSave = () => {
    if (sceneName.trim()) {
        onSaveScene(sceneName);
        setIsSaving(false);
        setSceneName('');
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
        setSoundTab('SELECT'); // Switch back to select
      } catch (err) {
        setError("Failed to upload sound file.");
      }
    }
  };

  const deleteSound = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSoundLibrary(soundLibrary.filter(s => s.id !== id));
    if (sceneSoundEffect?.id === id) {
      setSceneSoundEffect(undefined);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-lg mb-4">Scene Builder</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Selected Characters</label>
          <div className="bg-gray-800 p-2 rounded-md min-h-[40px] flex flex-wrap gap-2">
            {selectedCharacters.length > 0 ? selectedCharacters.map(c => (
              <span key={c.id} className="bg-indigo-600 text-white px-2 py-1 text-sm rounded">{c.name}</span>
            )) : <p className="text-gray-500 text-sm">Select from library</p>}
          </div>
        </div>
        <div>
          <label htmlFor="scene-prompt" className="block text-sm font-medium text-gray-300 mb-1">Scene Prompt</label>
          <textarea
            id="scene-prompt"
            rows={5}
            value={scenePrompt}
            onChange={(e) => setScenePrompt(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., A wizard teaching a young apprentice in a mystical library..."
          />
        </div>

        {/* Sound Effects Section */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
             <label className="block text-sm font-medium text-gray-300">Sound Effect / Ambience</label>
             <div className="flex gap-1 bg-gray-900 rounded p-0.5">
                <button 
                  onClick={() => setSoundTab('SELECT')}
                  className={`px-2 py-0.5 text-xs rounded ${soundTab === 'SELECT' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Select
                </button>
                <button 
                   onClick={() => setSoundTab('UPLOAD')}
                   className={`px-2 py-0.5 text-xs rounded ${soundTab === 'UPLOAD' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Upload
                </button>
             </div>
          </div>
          
          {soundTab === 'SELECT' ? (
             <div className="space-y-2">
                <div 
                   onClick={() => setSceneSoundEffect(undefined)}
                   className={`p-2 rounded text-sm cursor-pointer border ${!sceneSoundEffect ? 'border-indigo-500 bg-indigo-500/20' : 'border-transparent hover:bg-gray-700'}`}
                >
                   None
                </div>
                {soundLibrary.length === 0 && (
                   <p className="text-xs text-gray-500 italic p-2">Library empty. Upload a sound.</p>
                )}
                {soundLibrary.map(sound => (
                   <div 
                      key={sound.id}
                      onClick={() => setSceneSoundEffect(sound)}
                      className={`group flex items-center justify-between p-2 rounded text-sm cursor-pointer border ${sceneSoundEffect?.id === sound.id ? 'border-indigo-500 bg-indigo-500/20' : 'border-transparent hover:bg-gray-700'}`}
                   >
                      <div className="flex items-center gap-2 truncate">
                         <MusicIcon className="w-4 h-4 text-gray-400" />
                         <span className="truncate">{sound.name}</span>
                      </div>
                      <button 
                         onClick={(e) => deleteSound(sound.id, e)}
                         className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1"
                         title="Remove from library"
                      >
                         <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                   </div>
                ))}
             </div>
          ) : (
             <div className="text-center p-4 border-2 border-dashed border-gray-600 rounded">
                <input 
                   type="file" 
                   id="sound-upload" 
                   accept="audio/*" 
                   className="hidden" 
                   onChange={handleSoundUpload}
                />
                <Button onClick={() => document.getElementById('sound-upload')?.click()} variant="secondary" className="w-full text-sm">
                   <UploadIcon className="w-4 h-4" /> Choose Audio File
                </Button>
                <p className="text-xs text-gray-500 mt-2">MP3, WAV, OGG supported</p>
             </div>
          )}
        </div>
        
        {isSaving ? (
            <div className="bg-gray-700/50 p-3 rounded-md border border-gray-600 animate-fade-in">
                <label className="block text-xs font-medium text-gray-300 mb-1">Name your scene</label>
                <input 
                    type="text" 
                    value={sceneName}
                    onChange={(e) => setSceneName(e.target.value)}
                    placeholder="My Awesome Scene"
                    className="w-full bg-gray-900 border border-gray-700 rounded-md p-1.5 text-sm mb-2 focus:border-indigo-500 outline-none"
                    autoFocus
                />
                <div className="flex gap-2">
                    <Button onClick={confirmSave} disabled={!sceneName.trim()} className="w-full py-1 text-sm">Save</Button>
                    <Button onClick={() => setIsSaving(false)} variant="secondary" className="w-full py-1 text-sm">Cancel</Button>
                </div>
            </div>
        ) : (
            <div className="flex gap-2">
                <Button onClick={handleGenerate} disabled={selectedCharacters.length === 0} className="flex-grow">Generate Scene</Button>
                <Button onClick={initiateSave} disabled={selectedCharacters.length === 0} variant="secondary" title="Save Scene Setup">
                    <SaveIcon className="w-5 h-5" />
                </Button>
            </div>
        )}
      </div>
    </div>
  );
};

const ImageEditor: React.FC<Omit<ControlsPanelProps, 'activeTool' | 'selectedCharacters' | 'scenePrompt' | 'setScenePrompt' | 'onSaveScene' | 'sceneSoundEffect' | 'setSceneSoundEffect' | 'soundLibrary' | 'setSoundLibrary' | 'characterRotations'>> = ({ setLoading, setError, onGenerationComplete }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('Add a retro, vintage filter.');

  const handleGenerate = useCallback(async () => {
    if (!imageFile) {
      setError("Please upload an image to edit.");
      return;
    }
    setLoading(true, "Applying your edits...");
    setError(null);
    try {
      const imageUrl = await editImage(imageFile, prompt);
      onGenerationComplete({ type: 'image', url: imageUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit image.");
    } finally {
      setLoading(false, "");
    }
  }, [imageFile, prompt, setLoading, setError, onGenerationComplete]);

  return (
    <div>
      <h3 className="font-bold text-lg mb-4">Image Editor</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="image-upload" className="block text-sm font-medium text-gray-300 mb-1">Upload Image</label>
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            onChange={(e) => e.target.files && setImageFile(e.target.files[0])}
            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
          />
        </div>
        <div>
          <label htmlFor="edit-prompt" className="block text-sm font-medium text-gray-300 mb-1">Edit Prompt</label>
          <textarea
            id="edit-prompt"
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., Add a futuristic helmet to the character, change background to a cyberpunk city..."
          />
        </div>
        <Button onClick={handleGenerate} disabled={!imageFile} className="w-full">Generate Edit</Button>
      </div>
    </div>
  );
};

const VideoGenerator: React.FC<Omit<ControlsPanelProps, 'activeTool' | 'selectedCharacters' | 'scenePrompt' | 'setScenePrompt' | 'onSaveScene' | 'sceneSoundEffect' | 'setSceneSoundEffect' | 'soundLibrary' | 'setSoundLibrary' | 'characterRotations'>> = ({ setLoading, setError, onGenerationComplete }) => {
    const [isKeySelected, setIsKeySelected] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState('A neon hologram of a cat driving at top speed');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');

    const handleGenerate = useCallback(async () => {
        if (!imageFile) {
            setError("Please upload a starting image for the video.");
            return;
        }
        setError(null);
        try {
            const videoUrl = await generateVideo(imageFile, prompt, aspectRatio, (msg) => setLoading(true, msg));
            onGenerationComplete({ type: 'video', url: videoUrl });
        } catch (err) {
            if (err instanceof Error && err.message.includes('Requested entity was not found')) {
                setError("API Key error. Please re-select your key.");
                setIsKeySelected(false);
            } else {
                setError(err instanceof Error ? err.message : "Failed to generate video.");
            }
        } finally {
            setLoading(false, "");
        }
    }, [imageFile, prompt, aspectRatio, setLoading, setError, onGenerationComplete]);

    if (!isKeySelected) {
        return <ApiKeySelector onKeySelected={() => setIsKeySelected(true)} />;
    }

    return (
        <div>
            <h3 className="font-bold text-lg mb-4">Video Generator</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="video-image-upload" className="block text-sm font-medium text-gray-300 mb-1">Starting Image</label>
                    <input type="file" id="video-image-upload" accept="image/*" onChange={(e) => e.target.files && setImageFile(e.target.files[0])} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600" />
                </div>
                <div>
                    <label htmlFor="video-prompt" className="block text-sm font-medium text-gray-300 mb-1">Video Prompt</label>
                    <textarea id="video-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Aspect Ratio</label>
                    <div className="flex gap-2">
                        {(['16:9', '9:16'] as AspectRatio[]).map(ratio => (
                            <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`px-3 py-1.5 rounded-md text-sm ${aspectRatio === ratio ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                {ratio} {ratio === '16:9' ? '(Landscape)' : '(Portrait)'}
                            </button>
                        ))}
                    </div>
                </div>
                <Button onClick={handleGenerate} disabled={!imageFile} className="w-full">Generate Video</Button>
            </div>
        </div>
    );
};

const CharacterVoicePanel: React.FC<Omit<ControlsPanelProps, 'activeTool'>> = ({ 
    selectedCharacters, 
    setLoading, 
    setError, 
    onGenerationComplete 
}) => {
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
    const [text, setText] = useState('');
    const [voice, setVoice] = useState(VOICE_NAMES[0]);

    // Select the first selected character by default if available
    React.useEffect(() => {
        if (selectedCharacters.length > 0 && !selectedCharacterId) {
            setSelectedCharacterId(selectedCharacters[selectedCharacters.length - 1].id);
        }
    }, [selectedCharacters, selectedCharacterId]);

    const handleGenerate = async () => {
        if (!selectedCharacterId) {
            setError("Please select a character to speak.");
            return;
        }
        if (!text.trim()) {
            setError("Please enter some text for the character to say.");
            return;
        }

        setLoading(true, "Generating speech audio...");
        setError(null);

        try {
            const audioUrl = await generateCharacterSpeech(text, voice);
            onGenerationComplete({ 
                type: 'audio', 
                url: audioUrl,
                characterId: selectedCharacterId
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate speech.");
        } finally {
            setLoading(false, "");
        }
    };

    return (
        <div>
            <h3 className="font-bold text-lg mb-4">Character Voice (TTS)</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Speaker</label>
                    {selectedCharacters.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">Select a character from the library first.</p>
                    ) : (
                        <select 
                            value={selectedCharacterId} 
                            onChange={(e) => setSelectedCharacterId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md p-2"
                        >
                            {selectedCharacters.map(char => (
                                <option key={char.id} value={char.id}>{char.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Voice</label>
                    <select 
                        value={voice} 
                        onChange={(e) => setVoice(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2"
                    >
                        {VOICE_NAMES.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Script</label>
                    <textarea 
                        rows={4} 
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Hello, I am your generated character."
                        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2"
                    />
                </div>

                <Button onClick={handleGenerate} disabled={selectedCharacters.length === 0 || !text.trim()} className="w-full">
                    Generate Speech File
                </Button>
            </div>
        </div>
    );
};

export const ControlsPanel: React.FC<ControlsPanelProps> = (props) => {
  const renderControls = () => {
    switch (props.activeTool) {
      case 'SCENE_BUILDER':
        return <SceneBuilder {...props} />;
      case 'IMAGE_EDITOR':
        return <ImageEditor 
            setLoading={props.setLoading} 
            setError={props.setError} 
            onGenerationComplete={props.onGenerationComplete} 
        />;
      case 'VIDEO_GENERATOR':
        return <VideoGenerator 
            setLoading={props.setLoading} 
            setError={props.setError} 
            onGenerationComplete={props.onGenerationComplete} 
        />;
      case 'CHARACTER_VOICE':
        return <CharacterVoicePanel {...props} />;
      default:
        return null;
    }
  };

  return (
    <aside className="w-80 bg-gray-800/50 p-4 border-l border-gray-700 overflow-y-auto">
      {renderControls()}
    </aside>
  );
};
