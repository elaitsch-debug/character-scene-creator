import React, { useState, useEffect, useRef } from 'react';
import { GeneratedContent, Character, EditorState, ToolType } from '../types';
import { Loader } from './common/Loader';
import { SceneIcon, MicrophoneIcon, DownloadIcon, CloseIcon, SpeakerIcon, SpeakerXMarkIcon, CodeBracketIcon, SparklesIcon } from '../constants';
import { Button } from './common/Button';

interface CanvasProps {
  isLoading: boolean;
  loadingMessage: string;
  generatedContent: GeneratedContent | null;
  activeTool: ToolType;
  editorState: EditorState;
  error: string | null;
  selectedCharacters: Character[];
  onCharacterReorder: (reorderedCharacters: Character[]) => void;
  characterRotations: Record<string, number>;
  onRotationChange: (id: string, rotation: number) => void;
  characterPositions: Record<string, { x: number, y: number }>;
  onPositionChange: (id: string, position: { x: number, y: number }) => void;
}

const AudioPulse: React.FC = () => (
    <div className="flex items-center justify-center gap-1 h-8">
        {[...Array(8)].map((_, i) => (
            <div key={i} className="w-1 bg-indigo-500 rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${i * 0.1}s` }} />
        ))}
    </div>
);

export const Canvas: React.FC<CanvasProps> = ({ 
    isLoading, loadingMessage, generatedContent, activeTool, editorState, error, selectedCharacters, characterRotations, onRotationChange, characterPositions, onPositionChange
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const downloadMedia = (url: string, type: string, index?: number, isWatermarked?: boolean) => {
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const tag = isWatermarked ? '-watermark' : '-primary';
      a.download = `${type}${index !== undefined ? `-${index}` : ''}${tag}-${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const handleDownloadBatch = () => {
    if (generatedContent?.urls) {
        generatedContent.urls.forEach((url, i) => {
            const isWM = i % 2 !== 0;
            const indexLabel = Math.floor(i/2) + 1;
            // Delay slightly to prevent browser blocking multiple downloads
            setTimeout(() => downloadMedia(url, 'output', indexLabel, isWM), i * 350);
        });
    }
  };

  const renderContent = () => {
    if (isLoading) return <Loader message={loadingMessage} />;
    if (error) return (
        <div className="text-center text-red-400 p-8 border border-red-900/50 rounded-xl bg-red-900/10 backdrop-blur-md">
            <h3 className="font-bold mb-2">Error Encountered</h3>
            <p className="text-sm opacity-80 mb-6">{error}</p>
            <Button onClick={() => window.location.reload()} variant="secondary" className="px-8 text-xs">Reset Workspace</Button>
        </div>
    );

    if (generatedContent?.type === 'batch' && generatedContent.urls) {
        const count = generatedContent.urls.length;
        return (
            <div className="flex flex-col items-center w-full h-full max-w-6xl p-6 overflow-hidden animate-in fade-in duration-500">
                <div className="flex justify-between items-end w-full mb-8">
                    <div className="space-y-1">
                        <h3 className="text-2xl font-black text-emerald-400 flex items-center gap-3 uppercase tracking-tighter">
                            <SparklesIcon className="w-8 h-8" /> Generation Batch
                        </h3>
                        <p className="text-xs text-gray-500 font-medium">Pairs of high-resolution Primary and Watermarked scene variations.</p>
                    </div>
                    <Button onClick={handleDownloadBatch} className="bg-emerald-600 hover:bg-emerald-500 text-xs px-10 h-12 shadow-2xl shadow-emerald-900/40 transform hover:scale-105 transition-all">
                        <DownloadIcon className="w-5 h-5" /> Download All ({count}) PNGs
                    </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar flex-grow pb-16 pr-2">
                    {generatedContent.urls.map((url, i) => {
                        const isWM = i % 2 !== 0;
                        const pairIndex = Math.floor(i/2) + 1;
                        return (
                            <div key={i} className={`relative group bg-gray-800 rounded-xl overflow-hidden border-2 shadow-2xl transition-all ${isWM ? 'border-indigo-500/30' : 'border-white/5'}`}>
                                <img src={url} className="w-full h-auto aspect-square object-cover" loading="lazy" />
                                <div className={`absolute top-3 left-3 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest backdrop-blur-md shadow-xl ${isWM ? 'bg-indigo-600/80 text-white' : 'bg-black/60 text-gray-300'}`}>
                                    {isWM ? 'Watermarked' : `Primary ${pairIndex}`}
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button 
                                        onClick={() => downloadMedia(url, 'output', pairIndex, isWM)} 
                                        className="bg-white text-gray-900 p-3 rounded-full shadow-2xl transform scale-90 hover:scale-110 transition-transform"
                                        title="Download PNG"
                                    >
                                        <DownloadIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (activeTool === 'IMAGE_EDITOR' && editorState.workingImage) {
        return (
          <div className="relative group max-w-full max-h-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            <img src={editorState.workingImage} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/5" />
            <div className="absolute top-4 left-4 bg-indigo-600/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl ring-1 ring-white/20">Canvas Output</div>
            <button onClick={() => downloadMedia(editorState.workingImage!, 'edit')} className="absolute top-4 right-4 bg-gray-900/90 hover:bg-indigo-600 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl backdrop-blur-md">
                <DownloadIcon className="w-6 h-6" />
            </button>
          </div>
        );
    }

    if (generatedContent) {
        const { type, url } = generatedContent;
        if (type === 'audio') return (
            <div className="flex flex-col items-center gap-8 bg-gray-800/40 p-12 rounded-3xl border border-white/5 backdrop-blur-3xl shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
                <div className="w-56 h-56 rounded-3xl overflow-hidden border-2 border-indigo-500/30 bg-gray-900 flex flex-col items-center justify-center gap-4 shadow-inner">
                    <MicrophoneIcon className="w-20 h-20 text-indigo-400 opacity-50" />
                    <AudioPulse />
                    <p className="text-white font-black text-xs uppercase tracking-widest">Voice Synthesis</p>
                </div>
                <div className="flex items-center gap-4 w-full max-w-md">
                    <audio src={url} controls autoPlay className="flex-grow accent-indigo-500" />
                    <button onClick={() => downloadMedia(url, 'audio')} className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl shadow-lg transition-all hover:scale-105">
                        <DownloadIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>
        );
        return (
            <div className="relative group max-w-full max-h-full flex flex-col items-center animate-in fade-in duration-500">
                {type === 'video' ? (
                    <video src={url} controls autoPlay loop className="max-w-full max-h-full rounded-2xl shadow-2xl border border-white/5" />
                ) : (
                    <img src={url} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/5" />
                )}
                <button onClick={() => downloadMedia(url, type)} className="absolute top-4 right-4 bg-gray-900/90 hover:bg-indigo-600 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl">
                    <DownloadIcon className="w-6 h-6" />
                </button>
            </div>
        );
    }

    return (
      <div className="text-center text-gray-700 flex flex-col items-center gap-8 animate-in fade-in duration-1000">
        <div className="relative">
            <SceneIcon className="w-40 h-40 opacity-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
        </div>
        <div className="space-y-2">
            <h2 className="text-4xl font-black opacity-20 uppercase tracking-tighter">Studio Empty</h2>
            <p className="text-sm opacity-30 font-medium tracking-wide">Compose a scene or generate mockups to begin.</p>
        </div>
      </div>
    );
  };

  return (
    <main className="relative flex-grow min-w-0 p-10 flex items-center justify-center bg-gray-900/95 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#4f46e5_0.5px,transparent_0.5px)] [background-size:32px_32px]"></div>
      <div className="w-full h-full flex items-center justify-center relative z-10">
        {renderContent()}
      </div>
    </main>
  );
};
