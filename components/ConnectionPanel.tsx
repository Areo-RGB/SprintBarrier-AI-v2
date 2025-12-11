import React, { useState } from "react";
import { ConnectedDevice } from "../types";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "waiting"
  | "connected";

interface ConnectionPanelProps {
  peerId: string | null;
  hostCode: string | null;
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  connectedDevices: ConnectedDevice[];
  onJoin: (code: string) => void;
  onHost: () => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  peerId,
  hostCode,
  connectionStatus,
  isHost,
  connectedDevices,
  onJoin,
  onHost,
}) => {
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    setJoinCode(val);
  };

  if (connectionStatus === "connected") {
    return (
      <div className="bg-gradient-to-b from-cyan-950/40 to-gray-900 border border-cyan-500/30 rounded-xl p-4 shadow-lg shadow-cyan-900/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-cyan-400 font-bold tracking-wider leading-none text-sm">
                {isHost ? "HOST ACTIVE" : "LINKED"}
              </span>
              {isHost && hostCode && (
                <span className="text-[9px] text-blue-500/50 mt-0.5">
                  SESSION: {hostCode}
                </span>
              )}
            </div>
          </div>
          {isHost && (
            <span className="text-[10px] text-blue-400/70 bg-blue-950/60 px-2 py-1 rounded-md border border-blue-800/30">
              PEERS: {connectedDevices.length}
            </span>
          )}
        </div>

        {isHost && connectedDevices.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-800/30 flex flex-col gap-2">
            {connectedDevices.map((device) => (
              <div
                key={device.peerId}
                className="flex flex-col gap-1 py-1 border-b border-blue-800/20 last:border-0"
              >
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                    <span className="text-blue-200">{device.name}</span>
                  </div>
                  <div
                    className={`
                                px-1.5 py-0.5 rounded text-[9px] font-bold
                                ${
                                  device.latency < 0
                                    ? "text-blue-600"
                                    : device.latency < 100
                                    ? "text-cyan-400 bg-cyan-500/10"
                                    : device.latency < 300
                                    ? "text-yellow-400 bg-yellow-500/10"
                                    : "text-red-400 bg-red-500/10"
                                }
                            `}
                  >
                    {device.latency < 0 ? "..." : `${device.latency}ms`}
                  </div>
                </div>
                {device.avgLatency > 0 && (
                  <div className="flex justify-end items-center gap-2 text-[9px] text-blue-500/50 px-1">
                    <span>Comp: -{Math.floor(device.avgLatency / 2)}ms</span>
                    <span className="text-blue-700">|</span>
                    <span>Avg: {device.avgLatency}ms</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (connectionStatus === "waiting" && isHost) {
    return (
      <div className="bg-gradient-to-b from-amber-950/30 to-gray-900 border border-amber-500/30 rounded-xl p-5 text-center shadow-lg animate-fade-in">
        <h3 className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-2">
          Ready to Join
        </h3>
        <div className="text-4xl font-black text-white tracking-[0.3em] mb-2 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
          {hostCode || "..."}
        </div>
        <p className="text-blue-400/50 text-[10px] mb-3">
          Enter this code on other devices
        </p>

        {connectedDevices.length === 0 ? (
          <div className="flex justify-center items-center gap-2 text-[10px] text-blue-500/60 animate-pulse">
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
            Waiting for peers...
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[9px] text-blue-500/50 uppercase font-bold mb-2">
              Connected
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {connectedDevices.map((device, idx) => (
                <span
                  key={idx}
                  className="text-[10px] bg-cyan-950/50 text-cyan-400 px-2 py-1 rounded-md border border-cyan-500/30"
                >
                  {device.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-blue-950/40 to-gray-900 border border-blue-800/30 rounded-xl p-4">
      <h3 className="text-blue-400/70 text-[10px] font-bold uppercase tracking-widest mb-3">
        Multiplayer
      </h3>

      {!showJoinInput ? (
        <div className="flex gap-2">
          <button
            onClick={onHost}
            disabled={connectionStatus === "connecting"}
            className="flex-1 bg-blue-950/60 hover:bg-blue-900/60 text-blue-200 text-xs font-bold py-3 px-4 rounded-lg transition-all border border-blue-700/40 disabled:opacity-50 tracking-wide"
          >
            ◈ HOST
          </button>
          <button
            onClick={() => setShowJoinInput(true)}
            disabled={connectionStatus === "connecting"}
            className="flex-1 bg-blue-950/60 hover:bg-blue-900/60 text-blue-200 text-xs font-bold py-3 px-4 rounded-lg transition-all border border-blue-700/40 disabled:opacity-50 tracking-wide"
          >
            ◉ JOIN
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="000"
              value={joinCode}
              onChange={handleCodeChange}
              className="w-full bg-gray-950 border-2 border-blue-700/50 rounded-lg px-4 py-3 text-2xl text-center text-white focus:outline-none focus:border-cyan-400 tracking-[0.5em] placeholder:tracking-normal placeholder:text-blue-800 transition-colors"
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-blue-600 text-[10px] pointer-events-none">
              ID
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onJoin(joinCode)}
              disabled={
                joinCode.length !== 3 || connectionStatus === "connecting"
              }
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-blue-950 disabled:to-blue-950 disabled:text-blue-700 text-white text-xs font-bold py-2.5 rounded-lg transition-all border border-blue-400/20 disabled:border-blue-800/30"
            >
              CONNECT
            </button>
            <button
              onClick={() => setShowJoinInput(false)}
              className="px-4 bg-blue-950/60 hover:bg-blue-900/60 rounded-lg text-blue-400 border border-blue-700/40"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {connectionStatus === "connecting" && (
        <div className="mt-3 text-[10px] text-amber-400 text-center flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-3 w-3 text-amber-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Establishing link...
        </div>
      )}
    </div>
  );
};
