
import React, { useState } from 'react';
import { Character, Scene } from '../types';
import { Button } from './common/Button';
import { AddUserIcon, CollectionIcon, SceneIcon, TrashIcon, ImportIcon, ExportIcon } from '../constants';
import { downloadJson, readJsonFile } from '../utils/fileUtils';

interface SidebarProps {
  characters: Character[];
  selectedCharacterIds: string[];
  onCharacterSelect: (id: string) => void;
  onAddCharacterClick: () => void;
  onImportCharacter: (character: Character) => void;
  onImportLibrary: (characters: Character[]) => void;
  onDeleteCharacter: (id: string) => void;
  scenes: Scene[];
  onSceneSelect: (scene: Scene) => void;
  onImportScene: (scene: Scene) => void;
  onSceneDelete: (id: string) => void;
  maxCapacity?: number;
}

const CharacterCard: React.FC<{
  character: Character;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ character, isSelected, onSelect, onDelete }) => {
  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadJson(character, `character-${character.name.replace(/\s+/g, '_')}.json`);
  };

  // Use thumbnail if available for lighter library view
  const displayImage = character.thumbnailUrl || character.imageUrl;

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${
        isSelected ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/20' : 'border-transparent hover:border-indigo-600/50'
      }`}
    >
      <img src={displayImage} alt={character.name} className="w-full h-auto aspect-square object-cover bg-gray-900" loading="lazy" />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
        <p className="text-white font-semibold text-[10px] truncate pr-6">{character.name}</p>
      </div>
      <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleExport}
          className="bg-gray-900/80 p-1 rounded-full text-gray-300 hover:text-white"
          title="Export Character"
        >
          <ExportIcon className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="bg-gray-900/80 p-1 rounded-full text-gray-300 hover:text-red-400"
          title="Delete Character"
        >
          <TrashIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const SceneCard: React.FC<{
  scene: Scene;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ scene, onSelect, onDelete }) => {
  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadJson(scene, `scene-${scene.name.replace(/\s+/g, '_')}.json`);
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600 hover:bg-gray-700 transition-colors group relative">
      <div onClick={onSelect} className="cursor-pointer">
        <h4 className="font-semibold text-white text-sm mb-1 pr-6 truncate">{scene.name}</h4>
        <p className="text-[10px] text-gray-400 line-clamp-2 italic">"{scene.prompt}"</p>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
           <span className="bg-gray-800 px-1.5 py-0.5 rounded">{scene.characterIds?.length || 0} chars</span>
           <span>{new Date(scene.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
         <button 
            onClick={handleExport}
            className="p-1 text-gray-500 hover:text-white"
            title="Export Scene"
         >
            <ExportIcon className="w-4 h-4" />
         </button>
         <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 text-gray-500 hover:text-red-400"
            title="Delete Scene"
         >
            <TrashIcon className="w-4 h-4" />
         </button>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  characters, 
  selectedCharacterIds, 
  onCharacterSelect, 
  onAddCharacterClick,
  onImportCharacter,
  onImportLibrary,
  onDeleteCharacter,
  scenes,
  onSceneSelect,
  onImportScene,
  onSceneDelete,
  maxCapacity = 8
}) => {
  const [activeTab, setActiveTab] = useState<'CHARACTERS' | 'SCENES'>('CHARACTERS');

  const handleImportClick = (type: 'character' | 'scene') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const data = await readJsonFile(file);
          if (type === 'character') {
             if (Array.isArray(data)) {
                 onImportLibrary(data);
             } else if (data.id && data.name && data.imageUrl) {
                 onImportCharacter(data);
             } else {
                alert("Invalid character file.");
             }
          } else {
             if (data.id && data.name && Array.isArray(data.characterIds)) {
                onImportScene(data);
             } else {
                alert("Invalid scene file.");
             }
          }
        } catch (err) {
          console.error("Import failed", err);
          alert("Failed to read file.");
        }
      }
    };
    input.click();
  };

  const handleExportLibrary = () => {
      if (characters.length === 0) return;
      downloadJson(characters, 'character_library.json');
  };

  const atCapacity = characters.length >= maxCapacity;

  return (
    <aside className="w-64 flex-shrink-0 bg-gray-800/50 flex flex-col border-r border-gray-700">
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('CHARACTERS')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'CHARACTERS' ? 'bg-gray-800 text-white border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <CollectionIcon className="w-4 h-4" />
          Library
        </button>
        <button
          onClick={() => setActiveTab('SCENES')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'SCENES' ? 'bg-gray-800 text-white border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <SceneIcon className="w-4 h-4" />
          Scenes
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'CHARACTERS' ? (
          <>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Capacity</span>
                 <span className={`text-[10px] font-bold ${atCapacity ? 'text-orange-400' : 'text-indigo-400'}`}>
                    {characters.length} / {maxCapacity}
                 </span>
              </div>
              <div className="flex gap-2">
                <Button 
                    onClick={onAddCharacterClick} 
                    disabled={atCapacity}
                    className={`flex-1 text-xs px-2 ${atCapacity ? 'opacity-50 grayscale' : 'bg-indigo-600 shadow-lg shadow-indigo-500/10'}`}
                >
                  <AddUserIcon className="w-4 h-4" /> New
                </Button>
                <div className="flex gap-1">
                  <Button onClick={() => handleImportClick('character')} disabled={atCapacity} variant="secondary" className="px-2" title="Import Character">
                      <ImportIcon className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleExportLibrary} variant="secondary" className="px-2" title="Export Library" disabled={characters.length === 0}>
                      <ExportIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            {characters.length === 0 ? (
              <div className="text-center text-gray-500 mt-12 py-8 border-2 border-dashed border-gray-700 rounded-xl">
                <p className="text-xs font-medium">Library is empty</p>
                <p className="text-[10px] mt-1">Create or import characters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-8">
                {characters.map(char => (
                  <CharacterCard
                    key={char.id}
                    character={char}
                    isSelected={selectedCharacterIds.includes(char.id)}
                    onSelect={() => onCharacterSelect(char.id)}
                    onDelete={() => onDeleteCharacter(char.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
             <Button onClick={() => handleImportClick('scene')} variant="secondary" className="w-full mb-4 text-xs">
               <ImportIcon className="w-4 h-4" /> Import Scene
             </Button>
             {scenes.length === 0 ? (
               <div className="text-center text-gray-500 mt-12 py-8 border-2 border-dashed border-gray-700 rounded-xl">
                 <p className="text-xs font-medium">No saved scenes</p>
                 <p className="text-[10px] mt-1">Compose and save to list</p>
               </div>
             ) : (
               <div className="flex flex-col gap-3 pb-8">
                 {scenes.map(scene => (
                   <SceneCard 
                     key={scene.id} 
                     scene={scene} 
                     onSelect={() => onSceneSelect(scene)}
                     onDelete={() => onSceneDelete(scene.id)}
                   />
                 ))}
               </div>
             )}
          </>
        )}
      </div>
    </aside>
  );
};
