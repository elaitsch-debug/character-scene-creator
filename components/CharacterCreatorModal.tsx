
import React, { useState, useCallback } from 'react';
import { Character } from '../types';
import { generateCharacterDescription, generateCharacterImage } from '../services/geminiService';
import { Button } from './common/Button';
import { Loader } from './common/Loader';
import { CloseIcon } from '../constants';
import { fileToBase64 } from '../utils/fileUtils';

interface CharacterCreatorModalProps {
  onClose: () => void;
  onSave: (character: Character) => void;
}

type Step = 'UPLOAD' | 'DESCRIBE' | 'GENERATE' | 'SAVE';

export const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({ onClose, onSave }) => {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [description, setDescription] = useState('');
  const [characterPrompt, setCharacterPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [characterName, setCharacterName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const b64 = await fileToBase64(file);
      setImageBase64(b64);
      setStep('DESCRIBE');
      handleDescribe(file);
    }
  };

  const handleDescribe = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const desc = await generateCharacterDescription(file);
      setDescription(desc);
      setCharacterPrompt(desc);
    } catch (err) {
      setError('Failed to generate description. Please try again.');
      setStep('UPLOAD');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const img = await generateCharacterImage(characterPrompt);
      setGeneratedImage(img);
      setStep('SAVE');
    } catch (err) {
      setError('Failed to generate character image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (characterName && generatedImage) {
      const newCharacter: Character = {
        id: crypto.randomUUID(),
        name: characterName,
        imageUrl: generatedImage,
        prompt: characterPrompt,
      };
      onSave(newCharacter);
    }
  };
  
  const renderContent = () => {
    if (isLoading) {
      return <div className="h-64 flex items-center justify-center"><Loader message="AI is thinking..." /></div>;
    }

    switch (step) {
      case 'UPLOAD':
        return (
          <div className="text-center p-8 border-2 border-dashed border-gray-600 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Upload Character Image</h3>
            <p className="text-gray-400 mb-4">Upload a sketch or image of your character.</p>
            <input type="file" id="char-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
            <Button onClick={() => document.getElementById('char-upload')?.click()}>
              Choose File
            </Button>
            {error && <p className="text-red-500 mt-4">{error}</p>}
          </div>
        );
      case 'DESCRIBE':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-2">Refine Character</h3>
            <div className="flex gap-4">
              <img src={imageBase64} alt="Uploaded character" className="w-1/3 h-auto object-contain rounded-md" />
              <div className="w-2/3 flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Description (from Image)</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full h-24 p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        placeholder="Character description from image..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-indigo-300 mb-1">Character Prompt (for Generation)</label>
                    <textarea
                        value={characterPrompt}
                        onChange={(e) => setCharacterPrompt(e.target.value)}
                        className="w-full h-32 p-2 bg-gray-800 border border-indigo-500/50 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        placeholder="Prompt for image generation..."
                    />
                </div>
              </div>
            </div>
            {error && <p className="text-red-500 mt-4">{error}</p>}
            <div className="mt-4 flex justify-end">
              <Button onClick={handleGenerate}>Generate Character</Button>
            </div>
          </div>
        );
      case 'SAVE':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-2">Save Your Character</h3>
            <div className="flex gap-4">
              <img src={generatedImage} alt="Generated character" className="w-1/3 h-auto object-contain rounded-md" />
              <div className="w-2/3 flex flex-col gap-4">
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Enter character name..."
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md"
                />
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Prompt</label>
                    <textarea
                    value={characterPrompt}
                    readOnly
                    className="w-full h-40 p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-400 text-sm"
                    />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} disabled={!characterName}>Save to Library</Button>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <CloseIcon className="w-6 h-6" />
        </button>
        {renderContent()}
      </div>
    </div>
  );
};
