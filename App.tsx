
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Character, ToolType, GeneratedContent, Scene, SoundEffect } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { ControlsPanel } from './components/ControlsPanel';
import { CharacterCreatorModal } from './components/CharacterCreatorModal';
import { downloadJson } from './utils/fileUtils';

function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [soundLibrary, setSoundLibrary] = useState<SoundEffect[]>([]);
  
  const [activeTool, setActiveTool] = useState<ToolType>('SCENE_BUILDER');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [scenePrompt, setScenePrompt] = useState('Two characters having a picnic in a sunny park.');
  const [sceneSoundEffect, setSceneSoundEffect] = useState<SoundEffect | undefined>(undefined);
  
  // Track the currently loaded scene ID to allow updates instead of just creates
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  
  const [characterRotations, setCharacterRotations] = useState<Record<string, number>>({});
  const [characterPositions, setCharacterPositions] = useState<Record<string, { x: number; y: number }>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);

  // Refs for autosave to access current state in interval
  const scenePromptRef = useRef(scenePrompt);
  const selectedCharacterIdsRef = useRef(selectedCharacterIds);
  const characterRotationsRef = useRef(characterRotations);
  const characterPositionsRef = useRef(characterPositions);
  const sceneSoundEffectRef = useRef(sceneSoundEffect);

  // Sync refs with state
  useEffect(() => {
    scenePromptRef.current = scenePrompt;
  }, [scenePrompt]);

  useEffect(() => {
    selectedCharacterIdsRef.current = selectedCharacterIds;
  }, [selectedCharacterIds]);

  useEffect(() => {
    characterRotationsRef.current = characterRotations;
  }, [characterRotations]);
  
  useEffect(() => {
    characterPositionsRef.current = characterPositions;
  }, [characterPositions]);

  useEffect(() => {
    sceneSoundEffectRef.current = sceneSoundEffect;
  }, [sceneSoundEffect]);


  // Load from LocalStorage
  useEffect(() => {
    try {
      const savedChars = localStorage.getItem('css_characters');
      if (savedChars) {
        setCharacters(JSON.parse(savedChars));
      }
      const savedScenes = localStorage.getItem('css_scenes');
      if (savedScenes) {
        setScenes(JSON.parse(savedScenes));
      }
      const savedSounds = localStorage.getItem('css_sound_library');
      if (savedSounds) {
        setSoundLibrary(JSON.parse(savedSounds));
      }

      // Load autosave
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
      console.error("Failed to load from local storage", e);
    }
  }, []);

  // Autosave interval
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
      localStorage.setItem('css_autosave', JSON.stringify(dataToSave));
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Save to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem('css_characters', JSON.stringify(characters));
  }, [characters]);

  useEffect(() => {
    localStorage.setItem('css_scenes', JSON.stringify(scenes));
  }, [scenes]);

  useEffect(() => {
    localStorage.setItem('css_sound_library', JSON.stringify(soundLibrary));
  }, [soundLibrary]);


  const handleSetLoading = useCallback((loading: boolean, message: string) => {
    setIsLoading(loading);
    setLoadingMessage(message);
  }, []);

  const handleGenerationComplete = useCallback((content: GeneratedContent) => {
    setGeneratedContent(content);
    setError(null);
  }, []);

  const handleCharacterSelect = (id: string) => {
    setSelectedCharacterIds(prev =>
      prev.includes(id) 
        ? prev.filter(charId => charId !== id) 
        : [...prev, id] // Add new selections to the end (top layer)
    );
  };

  const handleCharacterReorder = useCallback((reorderedCharacters: Character[]) => {
    const newIds = reorderedCharacters.map(c => c.id);
    setSelectedCharacterIds(newIds);
  }, []);

  const handleSaveCharacter = (character: Character) => {
    setCharacters(prev => [...prev, character]);
    setIsCreatorModalOpen(false);
  };
  
  const handleImportCharacter = (character: Character) => {
    // Avoid duplicates by ID
    if (!characters.some(c => c.id === character.id)) {
        setCharacters(prev => [...prev, character]);
    } else {
        setCharacters(prev => prev.map(c => c.id === character.id ? character : c));
    }
  };

  const handleImportLibrary = (newCharacters: Character[]) => {
     setCharacters(prev => {
         const combined = [...prev];
         newCharacters.forEach(newChar => {
             const existingIndex = combined.findIndex(c => c.id === newChar.id);
             if (existingIndex >= 0) {
                 combined[existingIndex] = newChar; // Update existing
             } else {
                 combined.push(newChar); // Add new
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

    // If we are working on an existing scene and the name hasn't changed (or user wants to update it),
    // we update the existing record. If the name is different, it implies a "Save As" intent.
    if (existingScene && existingScene.name === name) {
        const updatedScene: Scene = {
            ...existingScene,
            characterIds: selectedCharacterIds,
            prompt: scenePrompt,
            soundEffect: sceneSoundEffect,
            rotations: characterRotations,
            positions: characterPositions,
            generatedContent: generatedContent || undefined,
        };
        setScenes(prev => prev.map(s => s.id === currentSceneId ? updatedScene : s));
    } else {
        // Create a new scene
        const newScene: Scene = {
            id: crypto.randomUUID(),
            name,
            characterIds: selectedCharacterIds,
            prompt: scenePrompt,
            createdAt: Date.now(),
            soundEffect: sceneSoundEffect,
            rotations: characterRotations,
            positions: characterPositions,
            generatedContent: generatedContent || undefined,
        };
        setScenes(prev => [newScene, ...prev]);
        setCurrentSceneId(newScene.id);
    }
  };

  const handleLoadScene = (scene: Scene) => {
    setSelectedCharacterIds(scene.characterIds);
    setScenePrompt(scene.prompt);
    setSceneSoundEffect(scene.soundEffect);
    setCharacterRotations(scene.rotations || {});
    setCharacterPositions(scene.positions || {});
    
    // Load generated content if available, otherwise clear it
    setGeneratedContent(scene.generatedContent || null);
    
    // Set the current scene ID so we can update it later
    setCurrentSceneId(scene.id);
    
    setActiveTool('SCENE_BUILDER');
  };
  
  const handleImportScene = (scene: Scene) => {
    if (!scenes.some(s => s.id === scene.id)) {
        setScenes(prev => [scene, ...prev]);
    } else {
        setScenes(prev => prev.map(s => s.id === scene.id ? scene : s));
    }
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
    if (currentSceneId === id) {
        setCurrentSceneId(null);
    }
  };
  
  const handleResetScene = () => {
    setSelectedCharacterIds([]);
    setScenePrompt('Two characters having a picnic in a sunny park.');
    setSceneSoundEffect(undefined);
    setCharacterRotations({});
    setCharacterPositions({});
    setCurrentSceneId(null);
    setGeneratedContent(null);
    setError(null);
  };
  
  // The order of selectedCharacterIds determines the layer order (index 0 is the back).
  // This logic preserves that order when creating the selectedCharacters array.
  const selectedCharacters = selectedCharacterIds
    .map(id => characters.find(c => c.id === id))
    .filter((c): c is Character => c !== undefined);
  
  const currentSceneName = scenes.find(s => s.id === currentSceneId)?.name;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900">
      <Header activeTool={activeTool} setActiveTool={setActiveTool} />
      <div className="flex flex-grow overflow-hidden">
        <Sidebar
          characters={characters}
          selectedCharacterIds={selectedCharacterIds}
          onCharacterSelect={handleCharacterSelect}
          onAddCharacterClick={() => setIsCreatorModalOpen(true)}
          onImportCharacter={handleImportCharacter}
          onImportLibrary={handleImportLibrary}
          onDeleteCharacter={handleDeleteCharacter}
          scenes={scenes}
          onSceneSelect={handleLoadScene}
          onImportScene={handleImportScene}
          onSceneDelete={handleDeleteScene}
        />
        <Canvas
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          generatedContent={generatedContent}
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
          selectedCharacters={selectedCharacters}
          setLoading={handleSetLoading}
          setError={setError}
          onGenerationComplete={handleGenerationComplete}
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
    </div>
  );
}

export default App;
