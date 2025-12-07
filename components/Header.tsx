
import React from 'react';
import { ToolType } from '../types';
import { SceneIcon, EditIcon, VideoIcon, MicrophoneIcon, PhotoIcon } from '../constants';

interface HeaderProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
}

const ToolButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

export const Header: React.FC<HeaderProps> = ({ activeTool, setActiveTool }) => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 w-full">
      <div className="max-w-screen-2xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">CharacterScene Studio</h1>
        <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-lg">
          <ToolButton
            label="Scene Builder"
            icon={<SceneIcon className="w-5 h-5" />}
            isActive={activeTool === 'SCENE_BUILDER'}
            onClick={() => setActiveTool('SCENE_BUILDER')}
          />
          <ToolButton
            label="Image Generator"
            icon={<PhotoIcon className="w-5 h-5" />}
            isActive={activeTool === 'IMAGE_GENERATOR'}
            onClick={() => setActiveTool('IMAGE_GENERATOR')}
          />
          <ToolButton
            label="Image Editor"
            icon={<EditIcon className="w-5 h-5" />}
            isActive={activeTool === 'IMAGE_EDITOR'}
            onClick={() => setActiveTool('IMAGE_EDITOR')}
          />
          <ToolButton
            label="Video Generator"
            icon={<VideoIcon className="w-5 h-5" />}
            isActive={activeTool === 'VIDEO_GENERATOR'}
            onClick={() => setActiveTool('VIDEO_GENERATOR')}
          />
          <ToolButton
            label="Character Voice"
            icon={<MicrophoneIcon className="w-5 h-5" />}
            isActive={activeTool === 'CHARACTER_VOICE'}
            onClick={() => setActiveTool('CHARACTER_VOICE')}
          />
        </div>
      </div>
    </header>
  );
};
