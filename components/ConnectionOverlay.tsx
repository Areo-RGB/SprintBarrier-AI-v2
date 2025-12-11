import React, { useState } from 'react';
import { ConnectedDevice } from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected';

interface ConnectionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  peerId: string | null;
  hostCode: string | null;
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  connectedDevices: ConnectedDevice[];
  onJoin: (code: string) => void;
  onHost: () => void;
}

export const ConnectionOverlay: React.FC<ConnectionOverlayProps> = ({
  isOpen,
  onClose,
  peerId,
  hostCode,
  connectionStatus,
  isHost,
  connectedDevices,
  onJoin,
  onHost
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
    setJoinCode(val);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Overlay Panel */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-h-[90vh] z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                  <rect x="9" y="2" width="6" height="6" rx="1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 18V14C4 13.4477 4.44772 13 5 13H19C19.5523 13 20 13.4477 20 14V18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="4" cy="20" r="2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="20" cy="20" r="2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="20" r="2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 8V18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Multiplayer</h2>
                <p className="text-xs text-gray-400">Connect with other devices</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-5 overflow-y-auto flex-1">
            {connectionStatus === 'connected' ? (
              // Connected State
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-950/40 to-gray-800 rounded-xl border border-cyan-500/30">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-cyan-400 font-bold tracking-wider text-sm">
                        {isHost ? 'HOST ACTIVE' : 'LINKED'}
                      </span>
                      {isHost && hostCode && (
                        <span className="text-xs text-blue-400/70 font-mono mt-1">
                          Session: {hostCode}
                        </span>
                      )}
                    </div>
                  </div>
                  {isHost && (
                    <span className="text-xs text-blue-300 font-mono bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-700/40">
                      {connectedDevices.length} {connectedDevices.length === 1 ? 'Peer' : 'Peers'}
                    </span>
                  )}
                </div>

                {isHost && connectedDevices.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Connected Devices</h3>
                    <div className="space-y-2">
                      {connectedDevices.map((device) => (
                        <div
                          key={device.peerId}
                          className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                              <span className="text-sm text-white font-medium">{device.name}</span>
                            </div>
                            <div
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                device.latency < 0
                                  ? 'text-blue-500'
                                  : device.latency < 100
                                  ? 'text-cyan-400 bg-cyan-500/10'
                                  : device.latency < 300
                                  ? 'text-yellow-400 bg-yellow-500/10'
                                  : 'text-red-400 bg-red-500/10'
                              }`}
                            >
                              {device.latency < 0 ? 'Measuring...' : `${device.latency}ms`}
                            </div>
                          </div>
                          {device.avgLatency > 0 && (
                            <div className="flex gap-4 text-xs text-gray-500 font-mono mt-2">
                              <span>Avg: {device.avgLatency}ms</span>
                              <span>Compensation: -{Math.floor(device.avgLatency / 2)}ms</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : connectionStatus === 'waiting' && isHost ? (
              // Waiting for Peers State
              <div className="text-center space-y-4">
                <div className="p-6 bg-gradient-to-b from-amber-950/30 to-gray-800 rounded-xl border border-amber-500/30">
                  <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3 font-mono">
                    Session Code
                  </h3>
                  <div className="text-5xl font-mono font-black text-white tracking-[0.3em] mb-3 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                    {hostCode || '...'}
                  </div>
                  <p className="text-blue-400/70 text-sm mb-4">
                    Enter this code on other devices to join
                  </p>

                  {connectedDevices.length === 0 ? (
                    <div className="flex justify-center items-center gap-2 text-sm text-blue-400/60 animate-pulse">
                      <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                      Waiting for peers...
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="text-xs text-gray-400 uppercase font-bold mb-2">Connected</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {connectedDevices.map((device) => (
                          <span
                            key={device.peerId}
                            className="text-xs bg-cyan-950/50 text-cyan-400 px-3 py-1.5 rounded-lg border border-cyan-500/30 font-mono"
                          >
                            {device.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Disconnected State - Join or Host
              <div className="space-y-4">
                {!showJoinInput ? (
                  <>
                    <div className="text-center mb-6">
                      <p className="text-gray-400 text-sm">
                        Connect multiple devices for synchronized timing
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={onHost}
                        disabled={connectionStatus === 'connecting'}
                        className="flex flex-col items-center gap-3 p-6 bg-gradient-to-b from-blue-950/60 to-gray-800 hover:from-blue-900/60 hover:to-gray-700 rounded-xl border border-blue-700/40 transition-all disabled:opacity-50"
                      >
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-blue-400">
                            <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                            <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <div className="text-blue-200 font-bold text-sm mb-1">Host Session</div>
                          <div className="text-blue-400/60 text-xs">Create a new room</div>
                        </div>
                      </button>

                      <button
                        onClick={() => setShowJoinInput(true)}
                        disabled={connectionStatus === 'connecting'}
                        className="flex flex-col items-center gap-3 p-6 bg-gradient-to-b from-blue-950/60 to-gray-800 hover:from-blue-900/60 hover:to-gray-700 rounded-xl border border-blue-700/40 transition-all disabled:opacity-50"
                      >
                        <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-cyan-400">
                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <div className="text-cyan-200 font-bold text-sm mb-1">Join Session</div>
                          <div className="text-cyan-400/60 text-xs">Connect to a room</div>
                        </div>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                        Session Code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="000"
                        value={joinCode}
                        onChange={handleCodeChange}
                        className="w-full bg-gray-800 border-2 border-blue-700/50 rounded-xl px-4 py-4 text-3xl text-center text-white focus:outline-none focus:border-cyan-400 font-mono tracking-[0.5em] placeholder:tracking-normal placeholder:text-gray-600 transition-colors"
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => onJoin(joinCode)}
                        disabled={joinCode.length !== 3 || connectionStatus === 'connecting'}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white text-sm font-bold py-3 rounded-xl transition-all"
                      >
                        Connect
                      </button>
                      <button
                        onClick={() => setShowJoinInput(false)}
                        className="px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 border border-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {connectionStatus === 'connecting' && (
                  <div className="mt-4 p-3 bg-amber-950/30 rounded-lg border border-amber-500/30 flex items-center justify-center gap-2 text-sm text-amber-400">
                    <svg
                      className="animate-spin h-4 w-4"
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
                    Establishing connection...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-gray-800 shrink-0">
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-xl transition-all transform active:scale-95 shadow-lg"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
