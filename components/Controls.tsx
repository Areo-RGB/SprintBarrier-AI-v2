import React from "react";
import { AppState } from "../types";

interface ControlsProps {
  appState: AppState;
  onArm: () => void;
  onReset: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  appState,
  onArm,
  onReset,
}) => {
  return (
    <div className="flex flex-col gap-3 p-4 bg-gradient-to-b from-blue-950/50 to-gray-900 rounded-xl border border-blue-800/30 shadow-lg transition-all">
      <div className="flex justify-between items-center">
        <h2 className="text-blue-400/70 text-[10px] font-bold uppercase tracking-widest">
          Control
        </h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              appState === AppState.ARMED
                ? "bg-red-500 ring-4 ring-red-500/20 animate-pulse"
                : appState === AppState.CALIBRATING
                ? "bg-amber-400 ring-4 ring-amber-400/20 animate-bounce"
                : "bg-blue-600"
            }`}
          ></div>
          <span className="text-[9px] text-blue-500/60 font-medium">
            {appState}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        {appState === AppState.IDLE || appState === AppState.FINISHED ? (
          <button
            onClick={onArm}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-4 px-6 rounded-lg transition-all transform active:scale-[0.98] shadow-lg shadow-blue-900/50 border border-blue-400/20 text-sm tracking-wide"
          >
            ▶ ARM SYSTEM
          </button>
        ) : (
          <button
            onClick={onReset}
            disabled={appState === AppState.CALIBRATING}
            className={`flex-1 font-bold py-4 px-6 rounded-lg transition-all transform active:scale-[0.98] shadow-lg text-sm tracking-wide
                ${
                  appState === AppState.CALIBRATING
                    ? "bg-amber-600/80 text-white/80 cursor-wait border border-amber-500/30"
                    : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-900/50 border border-red-400/20"
                }`}
          >
            {appState === AppState.CALIBRATING
              ? "◉ CALIBRATING..."
              : appState === AppState.ARMED
              ? "✕ CANCEL"
              : "↺ RESET"}
          </button>
        )}
      </div>
    </div>
  );
};
