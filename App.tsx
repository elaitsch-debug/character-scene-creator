
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Character, ToolType, GeneratedContent, Scene, SoundEffect, EditorState } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { ControlsPanel } from './components/ControlsPanel';
import { CharacterCreatorModal } from './components/CharacterCreatorModal';
import { SettingsModal } from './components/SettingsModal';
import { downloadJson } from './utils/fileUtils';

const MAX_CHARACTERS = 8;

function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [soundLibrary, setSoundLibrary] = useState<SoundEffect[]>([]);
  
  const [activeTool, setActiveTool] = useState<ToolType>('SCENE_BUILDER');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [scenePrompt, setScenePrompt] = useState('Characters having a gathering in a vibrant studio setting.');
  const [sceneSoundEffect, setSceneSoundEffect] = useState<SoundEffect | undefined>(undefined);
  
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  
  const [characterRotations, setCharacterRotations] = useState<Record<string, number>>({});
  const [characterPositions, setCharacterPositions] = useState<Record<string, { x: number; y: number }>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editorState, setEditorState] = useState<EditorState>({
    originalImage: null,
    workingImage: null,
    watermarkImage: null,
    selectedStyleId: null,
    lastGenerationId: null,
  });

  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Use refs for autosave to avoid stale closures and unnecessary re-renders
  const scenePromptRef = useRef(scenePrompt);
  const selectedCharacterIdsRef = useRef(selectedCharacterIds);
  const characterRotationsRef = useRef(characterRotations);
  const characterPositionsRef = useRef(characterPositions);
  const sceneSoundEffectRef = useRef(sceneSoundEffect);

  useEffect(() => {
    scenePromptRef.current = scenePrompt;
    selectedCharacterIdsRef.current = selectedCharacterIds;
    characterRotationsRef.current = characterRotations;
    characterPositionsRef.current = characterPositions;
    sceneSoundEffectRef.current = sceneSoundEffect;
  }, [scenePrompt, selectedCharacterIds, characterRotations, characterPositions, sceneSoundEffect]);

  // Safe storage helper with silent cleanup
  const safeSave = useCallback((key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Storage pressure detected. Attempting optimization...");
      if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
        // Simple heuristic: If storage is full, try pruning old scenes generated images
        setScenes(prev => {
            const pruned = prev.map((s, idx) => idx > 1 ? { ...s, generatedContent: undefined } : s);
            localStorage.setItem('css_scenes', JSON.stringify(pruned));
            return pruned;
        });
        // Retry once
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (retryError) {
            setError("Browser storage is full. Please delete some characters to save more.");
        }
      }
    }
  }, []);

  useEffect(() => {
    try {
      const savedChars = localStorage.getItem('css_characters');
      if (savedChars) setCharacters(JSON.parse(savedChars).slice(0, MAX_CHARACTERS));
      
      const savedScenes = localStorage.getItem('css_scenes');
      if (savedScenes) setScenes(JSON.parse(savedScenes));
      
      const savedSounds = localStorage.getItem('css_sound_library');
      if (savedSounds) setSoundLibrary(JSON.parse(savedSounds));

      const autosavedData = localStorage.getItem('css_autosave');
      if (autosavedData) {
        const parsed = JSON.parse(autosavedData);
        if (parsed.prompt) setScenePrompt(parsed.prompt);
        if (parsed.characterIds) setSelectedCharacterIds(parsed.characterIds);
        if (parsed.rotations) setCharacterRotations(parsed.rotations);
        if (parsed.positions) setCharacterPositions(parsed.positions);
        if (parsed.soundEffect) setSceneSoundEffect(parsed.soundEffect);
      }
    } catch (e) {
      console.error("Failed to recover data", e);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const dataToSave = {
        prompt: scenePromptRef.current,
        characterIds: selectedCharacterIdsRef.current,
        rotations: characterRotationsRef.current,
        positions: characterPositionsRef.current,
        soundEffect: sceneSoundEffectRef.current,
        timestamp: Date.now()
      };
      safeSave('css_autosave', dataToSave);
    }, 60000);
    return () => clearInterval(interval);
  }, [safeSave]);

  useEffect(() => {
    if (characters.length > 0) safeSave('css_characters', characters);
  }, [characters, safeSave]);

  useEffect(() => {
    if (scenes.length > 0) safeSave('css_scenes', scenes);
  }, [scenes, safeSave]);

  const handleSetLoading = useCallback((loading: boolean, message: string) => {
    setIsLoading(loading);
    setLoadingMessage(message);
  }, []);

  const handleGenerationComplete = useCallback((content: GeneratedContent) => {
    setGeneratedContent(content);
    if (activeTool === 'IMAGE_EDITOR' && content.type === 'image') {
      setEditorState(prev => ({
        ...prev,
        workingImage: content.url,
        lastGenerationId: crypto.randomUUID(),
      }));
    }
    setError(null);
  }, [activeTool]);

  const handleCharacterSelect = (id: string) => {
    setSelectedCharacterIds(prev =>
      prev.includes(id) 
        ? prev.filter(charId => charId !== id) 
        : [...prev, id]
    );
  };

  const handleCharacterReorder = useCallback((reorderedCharacters: Character[]) => {
    const newIds = reorderedCharacters.map(c => c.id);
    setSelectedCharacterIds(newIds);
  }, []);

  const handleSaveCharacter = (character: Character) => {
    setCharacters(prev => {
        if (prev.length >= MAX_CHARACTERS) return prev;
        return [...prev, character];
    });
    setIsCreatorModalOpen(false);
  };
  
  const handleUpdateCharacter = (updatedChar: Character) => {
    setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
  };
  
  const handleImportCharacter = (character: Character) => {
    setCharacters(prev => {
        if (prev.length >= MAX_CHARACTERS && !prev.some(c => c.id === character.id)) return prev;
        const exists = prev.some(c => c.id === character.id);
        if (!exists) return [...prev, character];
        return prev.map(c => c.id === character.id ? character : c);
    });
  };

  const handleImportLibrary = (newCharacters: Character[]) => {
     setCharacters(prev => {
         const combined = [...prev];
         newCharacters.forEach(newChar => {
             if (combined.length < MAX_CHARACTERS) {
                 const existingIndex = combined.findIndex(c => c.id === newChar.id);
                 if (existingIndex >= 0) combined[existingIndex] = newChar;
                 else combined.push(newChar);
             }
         });
         return combined;
     });
  };

  const handleDeleteCharacter = (id: string) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
    setSelectedCharacterIds(prev => prev.filter(cid => cid !== id));
  };

  const handleSaveScene = (name: string) => {
    const existingScene = scenes.find(s => s.id === currentSceneId);
    const sceneData = {
        characterIds: selectedCharacterIds,
        prompt: scenePrompt,
        soundEffect: sceneSoundEffect,
        rotations: characterRotations,
        positions: characterPositions,
        generatedContent: generatedContent || undefined,
    };

    if (existingScene && (existingScene.id === currentSceneId || existingScene.name === name)) {
        setScenes(prev => prev.map(s => s.id === existingScene.id ? { ...existingScene, ...sceneData, name } : s));
    } else {
        const newScene: Scene = {
            id: crypto.randomUUID(),
            name,
            ...sceneData,
            createdAt: Date.now(),
        };
        setScenes(prev => [newScene, ...prev]);
        setCurrentSceneId(newScene.id);
    }
  };

  const handleLoadScene = (scene: Scene) => {
    setSelectedCharacterIds(scene.characterIds || []);
    setScenePrompt(scene.prompt || '');
    setSceneSoundEffect(scene.soundEffect);
    setCharacterRotations(scene.rotations || {});
    setCharacterPositions(scene.positions || {});
    setGeneratedContent(scene.generatedContent || null);
    setCurrentSceneId(scene.id);
    setActiveTool('SCENE_BUILDER');
  };
  
  const handleImportScene = (scene: Scene) => {
    setScenes(prev => {
        const exists = prev.some(s => s.id === scene.id);
        if (!exists) return [scene, ...prev];
        return prev.map(s => s.id === scene.id ? scene : s);
    });
  };

  const handleExportScene = () => {
    const exportName = currentSceneName || "Untitled Scene";
    const sceneData: Scene = {
      id: currentSceneId || crypto.randomUUID(),
      name: exportName,
      characterIds: selectedCharacterIds,
      prompt: scenePrompt,
      createdAt: Date.now(),
      soundEffect: sceneSoundEffect,
      rotations: characterRotations,
      positions: characterPositions,
      generatedContent: generatedContent || undefined
    };
    downloadJson(sceneData, `scene-${exportName.replace(/\s+/g, '_')}.json`);
  };

  const handleDeleteScene = (id: string) => {
    setScenes(prev => prev.filter(s => s.id !== id));
    if (currentSceneId === id) setCurrentSceneId(null);
  };
  
  const handleResetScene = () => {
    setSelectedCharacterIds([]);
    setScenePrompt('Characters having a gathering in a vibrant studio setting.');
    setSceneSoundEffect(undefined);
    setCharacterRotations({});
    setCharacterPositions({});
    setCurrentSceneId(null);
    setGeneratedContent(null);
    setError(null);
  };
  
  const selectedCharacters = useMemo(() => {
    return selectedCharacterIds
        .map(id => characters.find(c => c.id === id))
        .filter((c): c is Character => c !== undefined && c !== null);
  }, [selectedCharacterIds, characters]);
  
  const currentSceneName = scenes.find(s => s.id === currentSceneId)?.name;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 overflow-hidden">
      <Header 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <div className="flex flex-grow overflow-x-auto overflow-y-hidden custom-scrollbar">
        <Sidebar
          characters={characters}
          selectedCharacterIds={selectedCharacterIds}
          onCharacterSelect={handleCharacterSelect}
          onAddCharacterClick={() => {
              if (characters.length < MAX_CHARACTERS) setIsCreatorModalOpen(true);
              else setError(`Limit reached: Maximum ${MAX_CHARACTERS} characters allowed.`);
          }}
          onImportCharacter={handleImportCharacter}
          onImportLibrary={handleImportLibrary}
          onDeleteCharacter={handleDeleteCharacter}
          scenes={scenes}
          onSceneSelect={handleLoadScene}
          onImportScene={handleImportScene}
          onSceneDelete={handleDeleteScene}
          maxCapacity={MAX_CHARACTERS}
        />
        <Canvas
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          generatedContent={generatedContent}
          activeTool={activeTool}
          editorState={editorState}
          error={error}
          selectedCharacters={selectedCharacters}
          onCharacterReorder={handleCharacterReorder}
          characterRotations={characterRotations}
          onRotationChange={(id, rot) => setCharacterRotations(prev => ({ ...prev, [id]: rot }))}
          characterPositions={characterPositions}
          onPositionChange={(id, pos) => setCharacterPositions(prev => ({ ...prev, [id]: pos }))}
        />
        <ControlsPanel
          activeTool={activeTool}
          characters={characters}
          selectedCharacters={selectedCharacters}
          setLoading={handleSetLoading}
          setError={setError}
          onGenerationComplete={handleGenerationComplete}
          onSaveCharacter={handleSaveCharacter}
          onUpdateCharacter={handleUpdateCharacter}
          editorState={editorState}
          setEditorState={setEditorState}
          scenePrompt={scenePrompt}
          setScenePrompt={setScenePrompt}
          onSaveScene={handleSaveScene}
          currentSceneName={currentSceneName}
          sceneSoundEffect={sceneSoundEffect}
          setSceneSoundEffect={setSceneSoundEffect}
          soundLibrary={soundLibrary}
          setSoundLibrary={setSoundLibrary}
          characterRotations={characterRotations}
          onResetScene={handleResetScene}
          scenes={scenes}
          onLoadScene={handleLoadScene}
          onExportScene={handleExportScene}
        />
      </div>
      {isCreatorModalOpen && (
        <CharacterCreatorModal 
          onClose={() => setIsCreatorModalOpen(false)}
          onSave={handleSaveCharacter}
        />
      )}
      {isSettingsOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
