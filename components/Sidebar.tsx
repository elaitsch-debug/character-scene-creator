
import React, { useState } from 'react';
import { Character, Scene } from '../types';
import { Button } from './common/Button';
import { AddUserIcon, CollectionIcon, SceneIcon, TrashIcon } from '../constants';

interface SidebarProps {
  characters: Character[];
  selectedCharacterIds: string[];
  onCharacterSelect: (id: string) => void;
  onAddCharacterClick: () => void;
  scenes: Scene[];
  onSceneSelect: (scene: Scene) => void;
  onSceneDelete: (id: string) => void;
}

const CharacterCard: React.FC<{
  character: Character;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ character, isSelected, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${
        isSelected ? 'border-indigo-500 scale-105' : 'border-transparent hover:border-indigo-600'
      }`}
    >
      <img src={character.imageUrl} alt={character.name} className="w-full h-auto aspect-square object-cover" />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
        <p className="text-white font-semibold text-sm truncate">{character.name}</p>
      </div>
    </div>
  );
};

const SceneCard: React.FC<{
  scene: Scene;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ scene, onSelect, onDelete }) => {
  return (
    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600 hover:bg-gray-700 transition-colors group relative">
      <div onClick={onSelect} className="cursor-pointer">
        <h4 className="font-semibold text-white text-sm mb-1">{scene.name}</h4>
        <p className="text-xs text-gray-400 line-clamp-2 italic">"{scene.prompt}"</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
           <span className="bg-gray-800 px-1.5 py-0.5 rounded">{scene.characterIds.length} chars</span>
           <span>{new Date(scene.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete Scene"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  characters, 
  selectedCharacterIds, 
  onCharacterSelect, 
  onAddCharacterClick,
  scenes,
  onSceneSelect,
  onSceneDelete
}) => {
  const [activeTab, setActiveTab] = useState<'CHARACTERS' | 'SCENES'>('CHARACTERS');

  return (
    <aside className="w-64 bg-gray-800/50 flex flex-col border-r border-gray-700">
      {/* Tabs */}
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

      <div className="flex-grow overflow-y-auto p-4">
        {activeTab === 'CHARACTERS' ? (
          <>
            <Button onClick={onAddCharacterClick} className="w-full mb-4">
              <AddUserIcon className="w-5 h-5" />
              New Character
            </Button>
            {characters.length === 0 ? (
              <div className="text-center text-gray-400 mt-8">
                <p>Your library is empty.</p>
                <p className="text-sm">Create a new character to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {characters.map(char => (
                  <CharacterCard
                    key={char.id}
                    character={char}
                    isSelected={selectedCharacterIds.includes(char.id)}
                    onSelect={() => onCharacterSelect(char.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
             {scenes.length === 0 ? (
               <div className="text-center text-gray-400 mt-8">
                 <p>No saved scenes.</p>
                 <p className="text-sm">Build a scene and save it to access it here later.</p>
               </div>
             ) : (
               <div className="flex flex-col gap-3">
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