import React, { useState } from 'react';
import { AppState, DetectionSettings } from '../types';

interface ControlsProps {
  appState: AppState;
  onArm: () => void;
  onReset: () => void;
  settings: DetectionSettings;
  onSettingsChange: (settings: DetectionSettings) => void;
}

export const Controls: React.FC<ControlsProps> = ({ 
  appState, 
  onArm, 
  onReset, 
  settings, 
  onSettingsChange 
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, sensitivity: parseInt(e.target.value) });
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-gray-900 rounded-2xl border border-gray-800 shadow-xl transition-all">
      <div className="flex justify-between items-center mb-1">
         <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Control Panel</h2>
         <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${appState === AppState.ARMED ? 'bg-red-500 animate-pulse' : (appState === AppState.CALIBRATING ? 'bg-amber-400 animate-bounce' : 'bg-gray-600')}`}></div>
            <span className="text-[10px] text-gray-500 font-mono">{appState}</span>
         </div>
      </div>

      <div className="flex gap-4">
        {appState === AppState.IDLE || appState === AppState.FINISHED ? (
          <button
            onClick={onArm}
            className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-4 px-6 rounded-xl transition-all transform active:scale-95 shadow-lg shadow-emerald-900/50"
          >
            ARM SYSTEM
          </button>
        ) : (
             <button
            onClick={onReset}
            disabled={appState === AppState.CALIBRATING}
            className={`flex-1 font-bold py-4 px-6 rounded-xl transition-all transform active:scale-95 shadow-lg 
                ${appState === AppState.CALIBRATING 
                    ? 'bg-amber-600 text-white/80 cursor-wait' 
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/50'}`}
          >
            {appState === AppState.CALIBRATING ? 'CALIBRATING...' : (appState === AppState.ARMED ? 'CANCEL' : 'RESET')}
          </button>
        )}
      </div>

      <div className="bg-gray-800/30 rounded-xl border border-gray-800 overflow-hidden">
        <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-full flex justify-between items-center p-3 text-left hover:bg-gray-800/50 transition-colors focus:outline-none"
        >
            <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-90' : ''}`}>
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
                <span>SETTINGS</span>
            </div>
            <div className="flex gap-2">
                {settings.torchEnabled && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded font-mono">TORCH</span>}
                <span className="text-xs font-mono text-emerald-500">{settings.sensitivity}%</span>
            </div>
        </button>
        
        {isSettingsOpen && (
            <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-1 fade-in duration-200">
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>SENSITIVITY</span>
                        <span>{settings.sensitivity}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={settings.sensitivity}
                      onChange={handleSensitivityChange}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2"
                    />
                    <p className="text-[10px] text-gray-500 text-center">
                        Adjust if lighting causes false starts.
                    </p>
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-700/50 pt-3">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-300 font-bold">FLASHLIGHT</span>
                        <span className="text-[10px] text-gray-500">Enable torch when ARMED</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={settings.torchEnabled}
                            onChange={(e) => onSettingsChange({...settings, torchEnabled: e.target.checked})}
                        />
                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};