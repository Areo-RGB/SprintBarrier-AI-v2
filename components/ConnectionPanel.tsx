import React, { useState } from 'react';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected';

interface ConnectionPanelProps {
  peerId: string | null;
  hostCode: string | null;
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  connectedDevices: string[];
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
  onHost
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  // Filter input to 3 digits only
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
    setJoinCode(val);
  };

  if (connectionStatus === 'connected') {
    return (
      <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-4 shadow-lg shadow-emerald-900/10">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div className="flex flex-col">
                    <span className="font-mono text-emerald-400 font-bold tracking-wider leading-none">
                        {isHost ? 'HOST ACTIVE' : 'LINKED'}
                    </span>
                    {isHost && hostCode && (
                        <span className="text-[10px] text-gray-500 font-mono mt-1">SESSION: {hostCode}</span>
                    )}
                </div>
            </div>
            {isHost && (
                <span className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded">
                    PEERS: {connectedDevices.length}
                </span>
            )}
        </div>
      </div>
    );
  }

  if (connectionStatus === 'waiting' && isHost) {
      return (
        <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-6 text-center shadow-lg animate-fade-in">
             <h3 className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-2">Ready to Join</h3>
             <div className="text-5xl font-mono font-bold text-white tracking-[0.2em] mb-2">
                 {hostCode || '...'}
             </div>
             <p className="text-gray-500 text-xs mb-4">Enter this code on other devices</p>
             
             {connectedDevices.length === 0 ? (
                 <div className="flex justify-center items-center gap-2 text-xs text-gray-600 animate-pulse">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    Waiting for peers...
                 </div>
             ) : (
                 <div className="mt-4">
                     <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Connected Devices</p>
                     <div className="flex flex-wrap justify-center gap-2">
                         {connectedDevices.map((device, idx) => (
                             <span key={idx} className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 font-mono">
                                 {device}
                             </span>
                         ))}
                     </div>
                 </div>
             )}
        </div>
      );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Multiplayer Setup</h3>
      
      {!showJoinInput ? (
        <div className="flex gap-2">
          <button 
            onClick={onHost}
            disabled={connectionStatus === 'connecting'}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold py-3 px-4 rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
          >
            HOST
          </button>
          <button 
            onClick={() => setShowJoinInput(true)}
            disabled={connectionStatus === 'connecting'}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold py-3 px-4 rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
          >
            JOIN
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative">
            <input
                type="text"
                inputMode="numeric"
                placeholder="000"
                value={joinCode}
                onChange={handleCodeChange}
                className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-2xl text-center text-white focus:outline-none focus:border-emerald-500 font-mono tracking-[0.5em] placeholder:tracking-normal"
            />
            <div className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-600 text-xs pointer-events-none">
                ID
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
                onClick={() => onJoin(joinCode)}
                disabled={joinCode.length !== 3 || connectionStatus === 'connecting'}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-sm font-bold py-2 rounded-lg transition-colors"
            >
                CONNECT
            </button>
            <button 
                onClick={() => setShowJoinInput(false)}
                className="px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400"
            >
                ✕
            </button>
          </div>
           <div className="text-[10px] text-center text-gray-600">
               Searching local network... (Fallback to ID)
           </div>
        </div>
      )}
      
      {connectionStatus === 'connecting' && (
          <div className="mt-3 text-xs text-yellow-500 text-center flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Establishing link...
          </div>
      )}
    </div>
  );
};