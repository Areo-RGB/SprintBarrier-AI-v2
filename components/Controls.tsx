import React from 'react';
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
  
  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, sensitivity: parseInt(e.target.value) });
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-xl">
      <div className="flex justify-between items-center mb-2">
         <h2 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Control Panel</h2>
         <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${appState === AppState.ARMED ? 'bg-red-500 animate-pulse' : (appState === AppState.CALIBRATING ? 'bg-amber-400 animate-bounce' : 'bg-gray-600')}`}></div>
            <span className="text-xs text-gray-500">{appState}</span>
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

      <div className="mt-2 bg-gray-800/50 p-4 rounded-xl">
        <label className="flex justify-between text-xs text-gray-400 mb-2 font-medium">
          <span>SENSITIVITY</span>
          <span>{settings.sensitivity}%</span>
        </label>
        <input
          type="range"
          min="1"
          max="100"
          value={settings.sensitivity}
          onChange={handleSensitivityChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <p className="text-[10px] text-gray-500 mt-2 text-center">
            Adjust if lighting causes false starts.
        </p>
      </div>
    </div>
  );
};