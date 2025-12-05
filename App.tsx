import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BarrierCam } from './components/BarrierCam';
import { TimerDisplay } from './components/TimerDisplay';
import { Controls } from './components/Controls';
import { ConnectionPanel, ConnectionStatus } from './components/ConnectionPanel';
import { SplitsList } from './components/SplitsList';
import { DebugConsole } from './components/DebugConsole';
import { useStopwatch } from './hooks/useStopwatch';
import { AppState, DetectionSettings, PeerMessage, TimerStatePayload } from './types';
import { Peer, DataConnection } from 'peerjs';

const PEER_PREFIX = 'sb-sprint-v1-';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [settings, setSettings] = useState<DetectionSettings>({
    sensitivity: 85
  });
  
  // Track if this specific device has already triggered for the current run
  const [hasTriggered, setHasTriggered] = useState(false);

  // Debugging
  const [logs, setLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
    console.log(`[App] ${msg}`);
  }, []);
  
  // Identify this device for testing/UX
  const [myDeviceName] = useState(() => `Unit-${Math.floor(Math.random() * 900) + 100}`);

  // Stopwatch Hook
  const { elapsed, splits, start, stop, reset, recordSplit, syncState } = useStopwatch();

  // PeerJS State
  const [peerId, setPeerId] = useState<string | null>(null);
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isHost, setIsHost] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<DataConnection[]>([]);
  const [connectedDeviceNames, setConnectedDeviceNames] = useState<string[]>([]);
  
  const peerRef = useRef<Peer | null>(null);
  const peerNameMap = useRef<Map<string, string>>(new Map());

  // Refs for event handlers to avoid stale closures in PeerJS callbacks
  const handlePeerMessageRef = useRef<(msg: PeerMessage, sender: DataConnection) => void>(() => {});
  const handleNewConnectionRef = useRef<(conn: DataConnection) => void>(() => {});

  // --- Main Logic (Defined before use in handlers) ---

  const broadcast = useCallback((msg: PeerMessage) => {
    connectedPeers.forEach(conn => {
        if (conn.open) conn.send(msg);
    });
  }, [connectedPeers]);

  const handleTriggerInternal = useCallback(() => {
    addLog(`Trigger Internal Called. State: ${appState}, IsHost: ${isHost}, Locked: ${hasTriggered}`);
    
    // Prevent duplicate triggers from the same device in a single run
    if (hasTriggered) {
        addLog("Trigger ignored: Device already triggered this run.");
        return;
    }
    
    if (appState === AppState.ARMED) {
      addLog("System ARMED -> STARTING");
      
      // Lock this device immediately
      setHasTriggered(true);
      
      const startTime = Date.now();
      start(startTime);
      setAppState(AppState.RUNNING);
      
      if (isHost) {
          const payload: TimerStatePayload = {
              state: AppState.RUNNING,
              startTime: startTime,
              splits: [],
          };
          broadcast({ type: 'STATE_SYNC', payload });
      }
    } else if (appState === AppState.RUNNING) {
      addLog(`System RUNNING. Attempting split. Current splits: ${splits.length}`);
      
      const newSplit = recordSplit();
      
      // Sync splits explicitly if we got a new one
      if (newSplit) {
           // Lock this device immediately on successful split
           setHasTriggered(true);
           
           addLog(`Split Recorded: ${newSplit.time}ms. ID: ${newSplit.id}`);
           if (isHost) {
                const payload: TimerStatePayload = {
                    state: AppState.RUNNING,
                    startTime: Date.now() - (elapsed || 0), 
                    splits: [...splits, newSplit],
                    elapsedOffset: elapsed
                };
                addLog(`Broadcasting new split count: ${payload.splits.length}`);
                broadcast({ type: 'STATE_SYNC', payload });
           }
      } else {
          addLog("Split ignored (Debounce or error)");
      }
    } else {
        addLog("Trigger ignored (State not ARMED or RUNNING)");
    }
  }, [appState, start, recordSplit, isHost, broadcast, elapsed, splits, addLog, hasTriggered]);

  // --- PeerJS Handlers ---

  const sendStateToPeer = useCallback((conn: DataConnection) => {
     addLog(`Syncing state to new peer ${conn.peer}`);
     const payload: TimerStatePayload = {
         state: appState,
         startTime: appState === AppState.RUNNING ? Date.now() - elapsed : null,
         splits: splits,
         elapsedOffset: elapsed
     };
     conn.send({ type: 'STATE_SYNC', payload });
  }, [appState, elapsed, splits, addLog]);

  const handlePeerMessage = useCallback((msg: PeerMessage, sender: DataConnection) => {
      if (msg.type === 'HELLO') {
          const name = msg.payload?.name || 'Unknown Device';
          addLog(`Device Hello: ${name} (${sender.peer})`);
          peerNameMap.current.set(sender.peer, name);
          setConnectedDeviceNames(Array.from(peerNameMap.current.values()));
          return;
      }

      if (isHost) {
          // HOST LOGIC
          if (msg.type === 'TRIGGER') {
              addLog(`Received TRIGGER from ${sender.peer}`);
              // Note: Remote triggers do not check local 'hasTriggered' state, 
              // as that state is for the local camera only.
              // Logic needs to handle if that specific peer triggered?
              // For now, we trust the client decided to send TRIGGER.
              handleTriggerInternal(); 
          }
      } else {
          // CLIENT LOGIC
          if (msg.type === 'STATE_SYNC') {
              const payload = msg.payload as TimerStatePayload;
              // Reset local trigger lock if system is resetting
              if (payload.state === AppState.IDLE || payload.state === AppState.ARMED) {
                  if (hasTriggered) {
                      addLog("State Sync: Resetting local trigger lock");
                      setHasTriggered(false);
                  }
              }

              setAppState(payload.state);
              const isRunning = payload.state === AppState.RUNNING;
              syncState(payload.elapsedOffset || 0, payload.splits, isRunning);
          }
      }
  }, [isHost, handleTriggerInternal, syncState, addLog, hasTriggered]);

  const handleNewConnection = useCallback((conn: DataConnection) => {
      addLog(`New Connection: ${conn.peer}`);
      conn.on('open', () => {
        addLog(`Connection Open: ${conn.peer}`);
        setConnectedPeers(prev => [...prev, conn]);
        setConnectionStatus('connected');
        
        conn.send({ type: 'HELLO', payload: { name: myDeviceName } });

        if (isHost) {
             sendStateToPeer(conn);
        }
      });

      // CRITICAL: Use Ref for data handler to avoid stale closures
      conn.on('data', (data: unknown) => {
        const msg = data as PeerMessage;
        handlePeerMessageRef.current(msg, conn);
      });
      
      conn.on('close', () => {
          addLog(`Connection Closed: ${conn.peer}`);
          setConnectedPeers(prev => prev.filter(p => p.peer !== conn.peer));
          peerNameMap.current.delete(conn.peer);
          setConnectedDeviceNames(Array.from(peerNameMap.current.values()));
      });

      conn.on('error', (err) => {
          addLog(`Connection Error: ${err}`);
      });
  }, [myDeviceName, isHost, sendStateToPeer, addLog]);

  // Keep refs updated
  useEffect(() => {
    handlePeerMessageRef.current = handlePeerMessage;
    handleNewConnectionRef.current = handleNewConnection;
  }, [handlePeerMessage, handleNewConnection]);

  // --- PeerJS Setup ---

  const startHosting = useCallback(() => {
    if (peerRef.current) peerRef.current.destroy();
    setConnectionStatus('connecting');
    setIsHost(true);
    setConnectedDeviceNames([]);
    peerNameMap.current.clear();
    addLog("Starting Host...");

    const tryRegisterHost = () => {
        const code = Math.floor(Math.random() * 900 + 100).toString(); 
        const fullId = `${PEER_PREFIX}${code}`;
        const peer = new Peer(fullId);

        peer.on('open', (id) => {
            addLog(`Host Registered: ${id}`);
            setPeerId(id);
            setHostCode(code);
            setConnectionStatus('waiting');
        });

        peer.on('error', (err) => {
            addLog(`Peer Error: ${err.type}`);
            if (err.type === 'unavailable-id') {
                peer.destroy();
                tryRegisterHost(); 
            } else {
                setConnectionStatus('disconnected');
            }
        });

        // CRITICAL: Use Ref for connection handler
        peer.on('connection', (conn) => {
            handleNewConnectionRef.current(conn);
        });
        
        peerRef.current = peer;
    };

    tryRegisterHost();
  }, [addLog]); 

  const joinSession = useCallback((code: string) => {
      if (peerRef.current) peerRef.current.destroy();
      setConnectionStatus('connecting');
      setIsHost(false);
      setConnectedDeviceNames([]);
      addLog(`Joining session: ${code}`);

      const peer = new Peer(); 
      
      peer.on('open', () => {
          addLog("Client Peer Open");
          const hostId = `${PEER_PREFIX}${code}`;
          const conn = peer.connect(hostId);
          // CRITICAL: Use Ref for connection handler
          handleNewConnectionRef.current(conn);
      });

      peer.on('error', (err) => {
          addLog(`Client Peer Error: ${err.type}`);
          setConnectionStatus('disconnected');
      });

      peerRef.current = peer;
  }, [addLog]); 

  // --- UI Handlers ---

  const handleTrigger = useCallback(() => {
    // If locked locally, don't even process wrapper (though handleTriggerInternal checks it too)
    if (hasTriggered) {
        addLog("Local Trigger blocked: Already triggered");
        return;
    }

    addLog("Handle Trigger Wrapper Called");
    if (isHost || connectedPeers.length === 0) {
        // Local Trigger (Host or Standalone)
        handleTriggerInternal();
    } else {
        // Client Trigger
        if (connectedPeers[0]?.open) {
            // Optimistically lock client to prevent multi-send
            setHasTriggered(true);
            addLog("Sending TRIGGER to Host");
            connectedPeers[0].send({ type: 'TRIGGER' });
        } else {
            addLog("Cannot send trigger: Host disconnected");
        }
    }
  }, [isHost, connectedPeers, handleTriggerInternal, addLog, hasTriggered]);

  const handleArm = () => {
    addLog("Manual Arm -> Broadcasting");
    reset(); 
    setAppState(AppState.ARMED);
    setHasTriggered(false); // Reset lock for new run
    
    if (isHost) {
        broadcast({ 
            type: 'STATE_SYNC', 
            payload: { 
                state: AppState.ARMED, 
                startTime: null, 
                splits: [], 
                elapsedOffset: 0 
            } 
        });
    }
  };

  const handleReset = () => {
    addLog("Manual Reset -> Broadcasting");
    stop();
    setAppState(AppState.IDLE);
    reset();
    setHasTriggered(false); // Reset lock
    
    if (isHost) {
        broadcast({ 
            type: 'STATE_SYNC', 
            payload: { 
                state: AppState.IDLE, 
                startTime: null, 
                splits: [], 
                elapsedOffset: 0 
            } 
        });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6 font-sans relative">
      <DebugConsole 
        logs={logs} 
        isOpen={showDebug} 
        onClose={() => setShowDebug(false)} 
        onClear={() => setLogs([])}
      />
      
      <header className="mb-6 flex justify-between items-end border-b border-gray-800 pb-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
            SprintBarrier<span className="text-white font-light">.AI</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">OPTICAL TIMING SYSTEM</p>
        </div>
        <div className="text-right flex flex-col items-end">
             <div className="flex items-center gap-2 mb-1">
                 <button 
                    onClick={() => setShowDebug(!showDebug)} 
                    className="text-[10px] bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded text-gray-400"
                 >
                     {showDebug ? 'HIDE LOGS' : 'DEBUG'}
                 </button>
                 <div className="text-xs font-mono text-gray-600">SYS.VER.1.8</div>
             </div>
             <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : (connectionStatus === 'waiting' ? 'bg-amber-500 animate-pulse' : 'bg-gray-600')}`}></div>
                 <div className="flex flex-col items-end">
                    <div className="text-xs font-mono text-emerald-600">
                        {connectionStatus === 'connected' ? 'LINKED' : (connectionStatus === 'waiting' ? 'WAITING' : 'LOCAL')}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                        {myDeviceName}
                    </div>
                 </div>
             </div>
        </div>
      </header>

      <main className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
        {/* Left Column: Video Feed & Config */}
        <div className="lg:w-1/3 flex flex-col gap-6">
            <div className="flex-grow min-h-[300px] lg:min-h-0">
                 <BarrierCam 
                    appState={appState} 
                    onTrigger={handleTrigger} 
                    settings={settings}
                    addLog={addLog}
                />
            </div>
            
            <div className="flex-shrink-0 flex flex-col gap-4">
                <Controls 
                    appState={appState} 
                    onArm={handleArm} 
                    onReset={handleReset} 
                    settings={settings} 
                    onSettingsChange={setSettings} 
                />
                
                <ConnectionPanel 
                    peerId={peerId}
                    hostCode={hostCode}
                    connectionStatus={connectionStatus}
                    isHost={isHost}
                    connectedDevices={connectedDeviceNames}
                    onHost={startHosting}
                    onJoin={joinSession}
                />
            </div>
        </div>

        {/* Right Column: Timer & Data */}
        <div className="lg:w-2/3 flex flex-col gap-6">
            <div className="h-[40vh] lg:h-1/2">
                <TimerDisplay elapsedMs={elapsed} state={appState} />
            </div>
            
            <SplitsList splits={splits} />
        </div>
      </main>
    </div>
  );
};

export default App;