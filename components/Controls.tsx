import React from 'react';
import { AppState } from '../types';

interface ControlsProps {
  appState: AppState;
  onArm: () => void;
  onReset: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  appState,
  onArm,
  onReset
}) => {

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
    </div>
  );
};