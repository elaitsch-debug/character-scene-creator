
import React, { useState, useEffect } from 'react';
import { Button } from './common/Button';

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}

export const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const [keyNeeded, setKeyNeeded] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setKeyNeeded(true);
        } else {
          onKeySelected();
        }
      } else {
         // If in an environment without aistudio, assume key is set via env
         onKeySelected();
      }
    };
    checkKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        // Assume success and proceed. Error handling in the service will catch invalid keys.
        setKeyNeeded(false);
        onKeySelected();
    }
  };

  if (!keyNeeded) {
    return null;
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-indigo-500/30 text-center">
      <h3 className="text-lg font-semibold text-white mb-2">API Key Required for Video Generation</h3>
      <p className="text-gray-400 mb-4">
        Veo video generation requires an API key with billing enabled. Please select your key to proceed.
      </p>
      <Button onClick={handleSelectKey}>Select API Key</Button>
      <a 
        href="https://ai.google.dev/gemini-api/docs/billing" 
        target="_blank" 
        rel="noopener noreferrer"
        className="block text-sm text-indigo-400 hover:underline mt-4"
      >
        Learn more about billing
      </a>
    </div>
  );
};
