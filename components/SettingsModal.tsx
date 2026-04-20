
import React, { useState, useEffect } from 'react';
import { Button } from './common/Button';
import { CloseIcon } from '../constants';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [provider, setProvider] = useState<'gemini' | 'vertex'>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [vertexKey, setVertexKey] = useState('');

  useEffect(() => {
    const savedProvider = localStorage.getItem('css_api_provider') as 'gemini' | 'vertex';
    if (savedProvider) setProvider(savedProvider);
    
    const savedGeminiKey = localStorage.getItem('css_gemini_key');
    if (savedGeminiKey) setGeminiKey(savedGeminiKey);
    
    const savedVertexKey = localStorage.getItem('css_vertex_key');
    if (savedVertexKey) setVertexKey(savedVertexKey);
  }, []);

  const handleSave = () => {
    localStorage.setItem('css_api_provider', provider);
    localStorage.setItem('css_gemini_key', geminiKey);
    localStorage.setItem('css_vertex_key', vertexKey);
    onClose();
    // Refresh page to apply keys to service
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-800/50">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">API Provider</label>
            <div className="flex gap-2">
              <button
                onClick={() => setProvider('gemini')}
                className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                  provider === 'gemini' 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                Gemini API
              </button>
              <button
                onClick={() => setProvider('vertex')}
                className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                  provider === 'vertex' 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                Vertex AI
              </button>
            </div>
          </div>

          {provider === 'gemini' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Gemini API Key</label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-gray-500">
                If left empty, the application will attempt to use the platform's default key.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Vertex API Key / Proxy Key</label>
              <input
                type="password"
                value={vertexKey}
                onChange={(e) => setVertexKey(e.target.value)}
                placeholder="Enter your Vertex API key..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-gray-500 font-medium text-amber-400/80">
                Note: Standard Vertex AI uses Google Cloud credentials. This field is for API keys used with Vertex compatible proxies or endpoints.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-700 bg-gray-800/50 flex gap-3">
          <Button onClick={onClose} variant="ghost" className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
