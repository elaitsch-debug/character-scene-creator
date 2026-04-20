
import React, { useState, useCallback } from 'react';
import { Character } from '../types';
import { generateCharacterDescription, generateCharacterWithStyle } from '../services/geminiService';
import { Button } from './common/Button';
import { Loader } from './common/Loader';
import { CloseIcon, CHARACTER_STYLES, SparklesIcon, AddUserIcon } from '../constants';
import { fileToBase64, compressImage, generateThumbnail } from '../utils/fileUtils';

interface CharacterCreatorModalProps {
  onClose: () => void;
  onSave: (character: Character) => void;
}

type Step = 'UPLOAD' | 'DESCRIBE' | 'GENERATE' | 'SAVE';

export const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({ onClose, onSave }) => {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [description, setDescription] = useState('');
  const [characterPrompt, setCharacterPrompt] = useState('');
  const [characterStyle, setCharacterStyle] = useState<string>('Default');
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [characterName, setCharacterName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedStyleMetadata, setAppliedStyleMetadata] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsLoading(true);
      try {
        const b64 = await fileToBase64(file);
        // Optimize base concept image to save memory
        const compressed = await compressImage(b64, 800, 0.7);
        setImageBase64(compressed);
        setStep('DESCRIBE');
        const desc = await generateCharacterDescription(file);
        setDescription(desc);
        setCharacterPrompt(desc);
      } catch (err) {
        setError('Failed to analyze image. Please try again.');
        setStep('UPLOAD');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (!characterName) {
      setError("Please enter a character name first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateCharacterWithStyle(
        characterName,
        characterPrompt,
        characterStyle === 'Default' ? undefined : characterStyle
      );
      // Compress the final AI output for storage safety
      const compressedOutput = await compressImage(result.image, 1024, 0.85);
      setGeneratedImage(compressedOutput);
      setAppliedStyleMetadata(result);
      setStep('SAVE');
    } catch (err) {
      setError('Failed to generate character image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (characterName && generatedImage) {
      setIsLoading(true);
      try {
        // Create a thumbnail for the library view
        const thumbnail = await generateThumbnail(generatedImage);
        const newCharacter: Character = {
          id: crypto.randomUUID(),
          name: characterName,
          imageUrl: generatedImage,
          thumbnailUrl: thumbnail,
          prompt: characterPrompt,
          jsonProfile: appliedStyleMetadata ? appliedStyleMetadata.metadata : undefined,
        };
        onSave(newCharacter);
      } catch (err) {
        console.error("Thumbnail generation failed", err);
        // Fallback save
        onSave({
          id: crypto.randomUUID(),
          name: characterName,
          imageUrl: generatedImage,
          prompt: characterPrompt,
        });
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const renderContent = () => {
    if (isLoading) {
      return <div className="h-64 flex items-center justify-center"><Loader message="AI is sculpting your character..." /></div>;
    }

    switch (step) {
      case 'UPLOAD':
        return (
          <div className="text-center p-8 border-2 border-dashed border-gray-600 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-indigo-300">Start with a Concept</h3>
            <p className="text-gray-400 mb-4 text-sm">Upload a concept sketch or photo to inspire the new creation.</p>
            <input type="file" id="char-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
            <Button onClick={() => document.getElementById('char-upload')?.click()} className="bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20">
              Select Concept Image
            </Button>
            {error && <p className="text-red-500 mt-4 text-sm font-medium">{error}</p>}
          </div>
        );
      case 'DESCRIBE':
        return (
          <div className="max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-indigo-400" /> Refine Character Concept
            </h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3 flex flex-col gap-4">
                <img src={imageBase64} alt="Concept" className="w-full h-auto object-contain rounded-lg border border-gray-700 shadow-md bg-gray-800/50 p-2" />
                <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 tracking-wider">Character Name</label>
                    <input
                      type="text"
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value)}
                      placeholder="e.g. Luna Skyward"
                      className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-white text-sm"
                    />
                </div>
              </div>
              <div className="md:w-2/3 flex flex-col gap-5">
                <div>
                    <label className="block text-[10px] uppercase font-bold text-indigo-400 mb-1 tracking-wider">Visual Style Selection</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-900/50 rounded-lg border border-gray-700 custom-scrollbar">
                        <button
                          onClick={() => setCharacterStyle('Default')}
                          className={`p-2 text-[10px] font-bold rounded border transition-all ${characterStyle === 'Default' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                        >
                          Default Studio
                        </button>
                        {CHARACTER_STYLES.map(style => (
                          <button
                            key={style.name}
                            onClick={() => setCharacterStyle(style.name)}
                            title={style.description}
                            className={`p-2 text-[10px] font-bold rounded border transition-all leading-tight ${characterStyle === style.name ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                          >
                            {style.name}
                          </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 tracking-wider">Base Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full h-20 p-2 bg-gray-800 border border-gray-700 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-xs text-gray-300"
                        placeholder="Character traits..."
                    />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-indigo-400 mb-1 tracking-wider">Generation Prompt</label>
                    <textarea
                        value={characterPrompt}
                        onChange={(e) => setCharacterPrompt(e.target.value)}
                        className="w-full h-24 p-2 bg-gray-800 border border-indigo-500/30 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-xs text-white"
                        placeholder="Final prompt for the engine..."
                    />
                </div>
              </div>
            </div>
            {error && <p className="text-red-500 mt-4 text-sm font-medium">{error}</p>}
            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end">
              <Button onClick={handleGenerate} disabled={!characterName} className="bg-indigo-600 hover:bg-indigo-500 px-6">
                Generate Stylized Character
              </Button>
            </div>
          </div>
        );
      case 'SAVE':
        return (
          <div className="max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <AddUserIcon className="w-5 h-5 text-emerald-400" /> Preview & Save
            </h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/2">
                <img src={generatedImage} alt="Generated result" className="w-full h-auto object-contain rounded-xl border-2 border-indigo-500/50 shadow-2xl shadow-indigo-500/10" />
              </div>
              <div className="md:w-1/2 flex flex-col gap-4">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Identity</label>
                    <p className="text-lg font-bold text-white">{characterName}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-indigo-400 mb-1">Style Applied</label>
                    <p className="text-sm font-medium text-white">{characterStyle}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Visual Identity Profile</label>
                    <div className="bg-gray-900/50 p-3 rounded border border-gray-700 text-[11px] text-gray-300 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                      {characterPrompt}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-gray-700 flex justify-between items-center">
              <button onClick={() => setStep('DESCRIBE')} className="text-sm text-gray-400 hover:text-white transition-colors">
                Back to Refine
              </button>
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/10 px-8">
                Save to Library
              </Button>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl p-8 relative ring-1 ring-white/10">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
          <CloseIcon className="w-6 h-6" />
        </button>
        {renderContent()}
      </div>
    </div>
  );
};
