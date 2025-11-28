
import React, { useState, useEffect, useRef } from 'react';
import { GeneratedContent, Character } from '../types';
import { Loader } from './common/Loader';
import { SceneIcon, MicrophoneIcon, DownloadIcon, CloseIcon, SpeakerIcon, SpeakerXMarkIcon } from '../constants';
import { Button } from './common/Button';

interface CanvasProps {
  isLoading: boolean;
  loadingMessage: string;
  generatedContent: GeneratedContent | null;
  error: string | null;
  selectedCharacters: Character[];
  onCharacterReorder: (reorderedCharacters: Character[]) => void;
  characterRotations: Record<string, number>;
  onRotationChange: (id: string, rotation: number) => void;
  characterPositions: Record<string, { x: number, y: number }>;
  onPositionChange: (id: string, position: { x: number, y: number }) => void;
}

const LayerManager: React.FC<{ 
  characters: Character[]; 
  onReorder: (reordered: Character[]) => void;
}> = ({ characters, onReorder }) => {
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        setDraggedItemId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
        e.preventDefault();
        if (!draggedItemId || draggedItemId === targetId) return;

        // The UI list is reversed, so we operate on a reversed copy
        const currentCharacters = [...characters].reverse();
        const draggedIndex = currentCharacters.findIndex(c => c.id === draggedItemId);
        const targetIndex = currentCharacters.findIndex(c => c.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const reordered = [...currentCharacters];
        const [draggedItem] = reordered.splice(draggedIndex, 1);
        reordered.splice(targetIndex, 0, draggedItem);
        
        // Reverse it back to the original order (back-to-front) before calling onReorder
        onReorder(reordered.reverse());
        setDraggedItemId(null);
    };
    
    const handleDragEnd = () => {
        setDraggedItemId(null);
    };

    if (characters.length <= 1) {
        return null;
    }

    return (
        <div className="absolute bottom-4 right-4 bg-gray-800/80 backdrop-blur-md border border-gray-600 rounded-lg p-3 shadow-lg z-10 w-48">
            <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Layers (Top to Bottom)</h4>
            <div className="space-y-2">
                {[...characters].reverse().map(char => (
                    <div
                        key={char.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, char.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, char.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-grab transition-all ${draggedItemId === char.id ? 'opacity-50 bg-indigo-500 scale-105' : 'bg-gray-700/50 hover:bg-gray-600/50'}`}
                    >
                        <img src={char.imageUrl} alt={char.name} className="w-8 h-8 rounded object-cover" />
                        <span className="text-sm font-medium text-white truncate">{char.name}</span>
                    </div>
                ))}
            </div>
             <p className="text-xs text-gray-500 mt-2 text-center">Drag to reorder layers.</p>
        </div>
    );
};

interface ImageDownloadModalProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageDownloadModal: React.FC<ImageDownloadModalProps> = ({ imageUrl, onClose }) => {
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [resolution, setResolution] = useState<1 | 2 | 4>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
        const img = new Image();
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth * resolution;
        canvas.height = img.naturalHeight * resolution;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Fill background with white for JPG to avoid black transparency
        if (format === 'jpg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpg' ? 0.95 : undefined;
        const dataUrl = canvas.toDataURL(mimeType, quality);

        const a = document.createElement('a');
        a.href = dataUrl;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resLabel = resolution === 1 ? 'original' : `${resolution}x`;
        a.download = `character-studio-${resLabel}-${timestamp}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        onClose();
    } catch (e) {
        console.error("Download failed", e);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-sm w-full relative shadow-2xl">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                <CloseIcon className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-bold text-white mb-4">Download Options</h3>
            
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Format</label>
                <div className="flex gap-2 bg-gray-900/50 p-1 rounded-lg">
                    {['png', 'jpg'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFormat(f as 'png' | 'jpg')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${format === f ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {f.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Resolution</label>
                <div className="flex gap-2 bg-gray-900/50 p-1 rounded-lg">
                    {[1, 2, 4].map(r => (
                        <button
                            key={r}
                            onClick={() => setResolution(r as 1 | 2 | 4)}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${resolution === r ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {r === 1 ? 'Original' : `${r}x`}
                        </button>
                    ))}
                </div>
            </div>

            <Button onClick={handleDownload} className="w-full" disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Download Image'}
            </Button>
        </div>
    </div>
  );
};

const AudioPlayer: React.FC<{ url: string }> = ({ url }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    
    // Auto-play attempt on mount
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.log("Autoplay blocked:", e));
        }
    }, [url]);

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    return (
        <div className="absolute top-4 left-4 z-20">
            <audio ref={audioRef} src={url} loop autoPlay muted={isMuted} />
            <button 
                onClick={toggleMute}
                className="bg-gray-900/80 hover:bg-indigo-600 text-white p-2 rounded-full shadow-lg transition-colors border border-gray-700"
                title={isMuted ? "Unmute Scene Audio" : "Mute Scene Audio"}
            >
                {isMuted ? <SpeakerXMarkIcon className="w-5 h-5" /> : <SpeakerIcon className="w-5 h-5" />}
            </button>
        </div>
    );
};

const TransformableCharacter: React.FC<{
    character: Character;
    rotation: number;
    position: { x: number, y: number };
    onRotationChange: (rot: number) => void;
    onPositionChange: (pos: { x: number, y: number }) => void;
    isSelected: boolean;
    onSelect: () => void;
    containerRef: React.RefObject<HTMLDivElement>;
}> = ({ character, rotation, position, onRotationChange, onPositionChange, isSelected, onSelect, containerRef }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const startRotationRef = useRef(0);
    const centerRef = useRef({ x: 0, y: 0 }); // Cache center point during rotation
    const elementRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        e.stopPropagation();
        onSelect();
        setIsDragging(true);
        startPosRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleRotateMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsRotating(true);
        if (elementRef.current) {
             const rect = elementRef.current.getBoundingClientRect();
             // Calculate center based on the rect at the start of rotation
             const centerX = rect.left + rect.width / 2;
             const centerY = rect.top + rect.height / 2;
             centerRef.current = { x: centerX, y: centerY };

             // Store initial angle relative to current rotation
             const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
             startRotationRef.current = currentAngle - rotation;
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const newX = e.clientX - startPosRef.current.x;
                const newY = e.clientY - startPosRef.current.y;
                onPositionChange({ x: newX, y: newY });
            } else if (isRotating) {
                // Use cached center to prevent jitter as element transform changes
                const { x: centerX, y: centerY } = centerRef.current;
                const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
                let newRotation = angle - startRotationRef.current;
                
                // Snap to 45 degrees if Shift is held
                if (e.shiftKey) {
                    newRotation = Math.round(newRotation / 45) * 45;
                }
                
                onRotationChange(newRotation);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsRotating(false);
        };

        if (isDragging || isRotating) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isRotating, onPositionChange, onRotationChange]);

    return (
        <div
            ref={elementRef}
            style={{
                transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
                position: 'absolute',
                top: 0,
                left: 0,
                cursor: isDragging ? 'grabbing' : 'grab',
                zIndex: isSelected ? 50 : undefined
            }}
            onMouseDown={handleMouseDown}
            className={`select-none ${isSelected ? 'z-50' : ''}`}
        >
            <div className={`relative ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}>
                <img 
                    src={character.imageUrl} 
                    alt={character.name} 
                    className="w-48 h-auto object-contain pointer-events-none"
                    draggable={false}
                />
                
                {isSelected && (
                    <div 
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-md cursor-crosshair flex items-center justify-center border border-gray-300 hover:bg-indigo-100"
                        onMouseDown={handleRotateMouseDown}
                        title="Drag to rotate (Hold Shift to snap)"
                    >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
                        <div className="absolute h-4 w-0.5 bg-indigo-500 top-full left-1/2 transform -translate-x-1/2"></div>
                    </div>
                )}
                
                {isSelected && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] px-1 rounded-bl">
                        {Math.round(rotation)}°
                    </div>
                )}
            </div>
        </div>
    );
};

export const Canvas: React.FC<CanvasProps> = ({ 
    isLoading, 
    loadingMessage, 
    generatedContent, 
    error, 
    selectedCharacters, 
    onCharacterReorder,
    characterRotations,
    onRotationChange,
    characterPositions,
    onPositionChange
}) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close modal if content changes
  useEffect(() => {
    setShowDownloadModal(false);
  }, [generatedContent]);
  
  // Set initial position to center for newly added characters
  useEffect(() => {
    if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        selectedCharacters.forEach(char => {
            if (!characterPositions[char.id]) {
                // Initialize at center roughly (assuming char width 200px)
                onPositionChange(char.id, { x: width / 2 - 100, y: height / 2 - 100 });
            }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacters.length]);

  const downloadMedia = (url: string, type: 'video' | 'audio') => {
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      let extension = 'dat';
      if (type === 'video') extension = 'mp4';
      if (type === 'audio') extension = 'wav';
      
      a.download = `character-studio-${type}-${timestamp}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const renderContent = () => {
    if (isLoading) {
      return <Loader message={loadingMessage} />;
    }
    if (error) {
      return (
        <div className="text-center text-red-400 bg-red-900/50 p-6 rounded-lg">
          <h3 className="font-bold text-lg mb-2">An Error Occurred</h3>
          <p>{error}</p>
        </div>
      );
    }
    if (generatedContent) {
      if (generatedContent.type === 'image') {
        return (
          <div className="relative group max-w-full max-h-full flex flex-col items-center">
            {generatedContent.soundEffectUrl && <AudioPlayer url={generatedContent.soundEffectUrl} />}
            <img src={generatedContent.url} alt="Generated content" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            <button 
                onClick={() => setShowDownloadModal(true)}
                className="absolute top-4 right-4 bg-gray-900/80 hover:bg-indigo-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg transform translate-y-2 group-hover:translate-y-0"
                title="Download Options"
            >
                <DownloadIcon className="w-6 h-6" />
            </button>
          </div>
        );
      }
      if (generatedContent.type === 'video') {
        return (
          <div className="relative group max-w-full max-h-full flex flex-col items-center">
             <video src={generatedContent.url} controls autoPlay loop className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
             <button 
                onClick={() => downloadMedia(generatedContent.url, 'video')}
                className="absolute top-4 right-4 bg-gray-900/80 hover:bg-indigo-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg transform translate-y-2 group-hover:translate-y-0 z-10"
                title="Download Video"
            >
                <DownloadIcon className="w-6 h-6" />
            </button>
          </div>
        );
      }
      if (generatedContent.type === 'audio') {
          const character = selectedCharacters.find(c => c.id === generatedContent.characterId) || selectedCharacters[0];
          return (
              <div className="flex flex-col items-center gap-6 bg-gray-800/80 p-8 rounded-xl border border-gray-700 backdrop-blur-sm max-w-lg w-full relative">
                  <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-indigo-500 shadow-xl">
                      {character ? (
                          <img src={character.imageUrl} alt={character.name} className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                              <MicrophoneIcon className="w-16 h-16 text-gray-500" />
                          </div>
                      )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-1">{character?.name || 'Unknown Character'}</h3>
                    <p className="text-sm text-gray-400">Generated Voice Audio</p>
                  </div>
                  <div className="w-full flex items-center gap-2">
                    <audio src={generatedContent.url} controls autoPlay className="w-full" />
                    <button 
                        onClick={() => downloadMedia(generatedContent.url, 'audio')}
                        className="bg-gray-700 hover:bg-indigo-600 text-white p-2.5 rounded-full transition-colors"
                        title="Download Audio"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                  </div>
              </div>
          )
      }
    }
    
    // Default: Interactive Stage
    if (selectedCharacters.length > 0) {
        return (
            <div 
                ref={containerRef}
                className="w-full h-full relative overflow-hidden bg-gray-800/30 rounded-xl border-2 border-dashed border-gray-700"
                onClick={() => setSelectedId(null)}
            >
                <div className="absolute top-4 left-4 text-gray-500 pointer-events-none z-0">
                    <p className="text-sm font-medium">Composition Stage</p>
                    <p className="text-xs">Drag to move, use handle to rotate.</p>
                </div>
                {selectedCharacters.map(char => (
                    <TransformableCharacter 
                        key={char.id}
                        character={char}
                        rotation={characterRotations[char.id] || 0}
                        position={characterPositions[char.id] || {x: 0, y: 0}}
                        onRotationChange={(rot) => onRotationChange(char.id, rot)}
                        onPositionChange={(pos) => onPositionChange(char.id, pos)}
                        isSelected={selectedId === char.id}
                        onSelect={() => setSelectedId(char.id)}
                        containerRef={containerRef}
                    />
                ))}
            </div>
        )
    }

    return (
      <div className="text-center text-gray-500 flex flex-col items-center gap-4">
        <SceneIcon className="w-24 h-24 text-gray-700" />
        <h2 className="text-2xl font-bold">Your Scene Awaits</h2>
        <p>Select characters from the library to start building.</p>
      </div>
    );
  };

  return (
    <main className="relative flex-grow p-6 flex items-center justify-center bg-gray-900/70">
      <div className="w-full h-full flex items-center justify-center">
        {renderContent()}
      </div>
      <LayerManager characters={selectedCharacters} onReorder={onCharacterReorder} />
      {showDownloadModal && generatedContent?.type === 'image' && (
        <ImageDownloadModal 
            imageUrl={generatedContent.url} 
            onClose={() => setShowDownloadModal(false)} 
        />
      )}
    </main>
  );
};
