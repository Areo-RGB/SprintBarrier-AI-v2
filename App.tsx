import React, { useState, useCallback, useEffect, useRef } from "react";
import { BarrierCam } from "./components/BarrierCam";
import { TimerDisplay } from "./components/TimerDisplay";
import { ConnectionStatus } from "./components/ConnectionPanel";
import { SplitsList } from "./components/SplitsList";
import { DebugConsole } from "./components/DebugConsole";
import { PWAUpdateNotification } from "./components/PWAUpdateNotification";
import { useStopwatch } from "./hooks/useStopwatch";
import {
  AppState,
  DetectionSettings,
  PeerMessage,
  TimerStatePayload,
  ConnectedDevice,
} from "./types";
import { Peer, DataConnection } from "peerjs";

const PEER_PREFIX = "sb-sprint-v1-";

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [settings, setSettings] = useState<DetectionSettings>({
    sensitivity: 85,
    torchEnabled: false,
    minDelayBetweenDetections: 500,
  });

  // Debugging
  const [logs, setLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toISOString().split("T")[1].slice(0, -1);
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
    console.log(`[App] ${msg}`);
  }, []);

  // Identify this device for testing/UX
  const [myDeviceName] = useState(
    () => `Unit-${Math.floor(Math.random() * 900) + 100}`
  );

  // Stopwatch Hook
  const { elapsed, splits, start, stop, reset, recordSplit, syncState } =
    useStopwatch();

  // PeerJS State
  const [peerId, setPeerId] = useState<string | null>(null);
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [isHost, setIsHost] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<DataConnection[]>([]);

  // Rich device info state for UI
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>(
    []
  );

  const peerRef = useRef<Peer | null>(null);

  // Calibration Refs
  const calibrationSamplesRef = useRef<Map<string, number[]>>(new Map());
  const calibrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Refs for event handlers to avoid stale closures in PeerJS callbacks
  const handlePeerMessageRef = useRef<
    (msg: PeerMessage, sender: DataConnection) => void
  >(() => {});
  const handleNewConnectionRef = useRef<(conn: DataConnection) => void>(
    () => {}
  );

  // --- Main Logic (Defined before use in handlers) ---

  const broadcast = useCallback(
    (msg: PeerMessage) => {
      connectedPeers.forEach((conn) => {
        if (conn.open) conn.send(msg);
      });
    },
    [connectedPeers]
  );

  const handleTriggerInternal = useCallback(
    (senderPeerId?: string) => {
      addLog(
        `Trigger Internal Called. State: ${appState}, IsHost: ${isHost}, Sender: ${
          senderPeerId || "Local"
        }`
      );

      // Calculate network compensation if remote trigger
      let compensationMs = 0;
      if (senderPeerId && isHost) {
        const device = connectedDevices.find((d) => d.peerId === senderPeerId);
        if (device && device.avgLatency > 0) {
          compensationMs = Math.floor(device.avgLatency / 2);
          addLog(
            `Applying latency compensation: -${compensationMs}ms (Avg RTT: ${device.avgLatency}ms)`
          );
        }
      }

      const now = Date.now();
      // The event effectively happened 'compensationMs' ago
      const effectiveTime = now - compensationMs;

      if (appState === AppState.ARMED) {
        addLog("System ARMED -> STARTING");

        start(effectiveTime);
        setAppState(AppState.RUNNING);

        if (isHost) {
          const payload: TimerStatePayload = {
            state: AppState.RUNNING,
            startTime: effectiveTime,
            splits: [],
          };
          broadcast({ type: "STATE_SYNC", payload });
        }
      } else if (appState === AppState.RUNNING) {
        addLog(
          `System RUNNING. Attempting split. Current splits: ${splits.length}`
        );

        const compensatedElapsed = Math.max(0, elapsed - compensationMs);

        const newSplit = recordSplit(compensatedElapsed);

        // Sync splits explicitly if we got a new one
        if (newSplit) {
          addLog(`Split Recorded: ${newSplit.time}ms. ID: ${newSplit.id}`);
          if (isHost) {
            const payload: TimerStatePayload = {
              state: AppState.RUNNING,
              startTime: Date.now() - elapsed, // Maintain original anchor
              splits: [...splits, newSplit],
              elapsedOffset: elapsed,
            };
            addLog(`Broadcasting new split count: ${payload.splits.length}`);
            broadcast({ type: "STATE_SYNC", payload });
          }
        } else {
          addLog("Split ignored (Debounce or error)");
        }
      } else {
        addLog(`Trigger ignored (State: ${appState})`);
      }
    },
    [
      appState,
      start,
      recordSplit,
      isHost,
      broadcast,
      elapsed,
      splits,
      addLog,
      connectedDevices,
    ]
  );

  // --- PeerJS Handlers ---

  const sendStateToPeer = useCallback(
    (conn: DataConnection) => {
      addLog(`Syncing state to new peer ${conn.peer}`);
      const payload: TimerStatePayload = {
        state: appState,
        startTime: appState === AppState.RUNNING ? Date.now() - elapsed : null,
        splits: splits,
        elapsedOffset: elapsed,
      };
      conn.send({ type: "STATE_SYNC", payload });
    },
    [appState, elapsed, splits, addLog]
  );

  const handlePeerMessage = useCallback(
    (msg: PeerMessage, sender: DataConnection) => {
      // Handshake / Identification
      if (msg.type === "HELLO") {
        const name = msg.payload?.name || "Unknown Device";
        addLog(`Device Hello: ${name} (${sender.peer})`);

        if (isHost) {
          setConnectedDevices((prev) => {
            const exists = prev.find((d) => d.peerId === sender.peer);
            if (exists) {
              return prev.map((d) =>
                d.peerId === sender.peer ? { ...d, name } : d
              );
            }
            return [
              ...prev,
              { peerId: sender.peer, name, latency: -1, avgLatency: 0 },
            ];
          });
        }
        return;
      }

      // Latency Checks
      if (msg.type === "PING") {
        // Client: Reply to PING
        sender.send({ type: "PONG", payload: msg.payload });
        return;
      }

      if (msg.type === "PONG") {
        // Host: Calculate latency
        if (isHost) {
          const rtt = Date.now() - msg.payload.ts;

          // If calibrating, collect sample
          if (appState === AppState.CALIBRATING) {
            const samples =
              calibrationSamplesRef.current.get(sender.peer) || [];
            samples.push(rtt);
            calibrationSamplesRef.current.set(sender.peer, samples);
          }

          setConnectedDevices((prev) =>
            prev.map((d) =>
              d.peerId === sender.peer ? { ...d, latency: rtt } : d
            )
          );
        }
        return;
      }

      if (isHost) {
        // HOST LOGIC
        if (msg.type === "TRIGGER") {
          addLog(`Received TRIGGER from ${sender.peer}`);
          handleTriggerInternal(sender.peer);
        }
      } else {
        // CLIENT LOGIC
        if (msg.type === "STATE_SYNC") {
          const payload = msg.payload as TimerStatePayload;
          setAppState(payload.state);
          const isRunning = payload.state === AppState.RUNNING;
          syncState(payload.elapsedOffset || 0, payload.splits, isRunning);
        }
      }
    },
    [isHost, handleTriggerInternal, syncState, addLog, appState]
  );

  const handleNewConnection = useCallback(
    (conn: DataConnection) => {
      addLog(`New Connection: ${conn.peer}`);

      conn.on("open", () => {
        addLog(`Connection Open: ${conn.peer}`);
        setConnectedPeers((prev) => [...prev, conn]);
        setConnectionStatus("connected");

        conn.send({ type: "HELLO", payload: { name: myDeviceName } });

        if (isHost) {
          sendStateToPeer(conn);
          // Initialize in list (name will update on HELLO)
          setConnectedDevices((prev) => {
            if (prev.find((d) => d.peerId === conn.peer)) return prev;
            return [
              ...prev,
              {
                peerId: conn.peer,
                name: "Connecting...",
                latency: -1,
                avgLatency: 0,
              },
            ];
          });
        }
      });

      // CRITICAL: Use Ref for data handler to avoid stale closures
      conn.on("data", (data: unknown) => {
        const msg = data as PeerMessage;
        handlePeerMessageRef.current(msg, conn);
      });

      conn.on("close", () => {
        addLog(`Connection Closed: ${conn.peer}`);
        setConnectedPeers((prev) => prev.filter((p) => p.peer !== conn.peer));
        // Remove from UI list
        setConnectedDevices((prev) =>
          prev.filter((d) => d.peerId !== conn.peer)
        );
      });

      conn.on("error", (err) => {
        addLog(`Connection Error: ${err}`);
      });
    },
    [myDeviceName, isHost, sendStateToPeer, addLog]
  );

  // Keep refs updated
  useEffect(() => {
    handlePeerMessageRef.current = handlePeerMessage;
    handleNewConnectionRef.current = handleNewConnection;
  }, [handlePeerMessage, handleNewConnection]);

  // Ping Loop (Host Only)
  useEffect(() => {
    if (!isHost) return;

    // Different interval based on state
    const intervalMs = appState === AppState.CALIBRATING ? 100 : 2000;

    const timer = setInterval(() => {
      connectedPeers.forEach((p) => {
        if (p.open) p.send({ type: "PING", payload: { ts: Date.now() } });
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isHost, connectedPeers, appState]);

  // --- PeerJS Setup ---

  const startHosting = useCallback(() => {
    if (peerRef.current) peerRef.current.destroy();
    setConnectionStatus("connecting");
    setIsHost(true);
    setConnectedDevices([]);
    addLog("Starting Host...");

    const code = '999';
    const fullId = `${PEER_PREFIX}${code}`;

    // First, try to clear any stale session by attempting to connect with a temporary peer
    addLog("Checking for stale session...");
    const tempPeer = new Peer();

    tempPeer.on("open", () => {
      const testConn = tempPeer.connect(fullId);

      // If connection succeeds, a stale session exists
      testConn.on("open", () => {
        addLog("Found stale session, cleaning up...");
        testConn.close();
        tempPeer.destroy();

        // Wait a moment for cleanup, then start fresh
        setTimeout(() => {
          startFreshHost();
        }, 500);
      });

      // If connection fails, no stale session - start immediately
      testConn.on("error", () => {
        addLog("No stale session found");
        tempPeer.destroy();
        startFreshHost();
      });

      // Timeout fallback - start anyway after 2 seconds
      setTimeout(() => {
        if (tempPeer && !tempPeer.destroyed) {
          addLog("Cleanup check timeout, proceeding...");
          tempPeer.destroy();
          startFreshHost();
        }
      }, 2000);
    });

    tempPeer.on("error", (err) => {
      addLog(`Cleanup check error: ${err.type}`);
      tempPeer.destroy();
      startFreshHost();
    });

    function startFreshHost() {
      addLog("Creating new host session...");
      const peer = new Peer(fullId);

      peer.on("open", (id) => {
        addLog(`Host Registered: ${id}`);
        setPeerId(id);
        setHostCode(code);
        setConnectionStatus("waiting");
      });

      peer.on("error", (err) => {
        addLog(`Peer Error: ${err.type}`);
        if (err.type === "unavailable-id") {
          addLog("Session ID still in use, retrying in 2s...");
          setTimeout(() => {
            peer.destroy();
            startHosting();
          }, 2000);
        } else {
          setConnectionStatus("disconnected");
        }
      });

      // CRITICAL: Use Ref for connection handler
      peer.on("connection", (conn) => {
        handleNewConnectionRef.current(conn);
      });

      peerRef.current = peer;
    }
  }, [addLog]);

  const joinSession = useCallback(
    (code: string) => {
      if (peerRef.current) peerRef.current.destroy();
      setConnectionStatus("connecting");
      setIsHost(false);
      setConnectedDevices([]);
      addLog(`Joining session: ${code}`);

      const peer = new Peer();

      peer.on("open", () => {
        addLog("Client Peer Open");
        const hostId = `${PEER_PREFIX}${code}`;
        const conn = peer.connect(hostId);
        // CRITICAL: Use Ref for connection handler
        handleNewConnectionRef.current(conn);
      });

      peer.on("error", (err) => {
        addLog(`Client Peer Error: ${err.type}`);
        setConnectionStatus("disconnected");
      });

      peerRef.current = peer;
    },
    [addLog]
  );

  // --- UI Handlers ---

  const handleTrigger = useCallback(() => {
    addLog("Handle Trigger Wrapper Called");
    if (isHost || connectedPeers.length === 0) {
      // Local Trigger (Host or Standalone)
      handleTriggerInternal();
    } else {
      // Client Trigger
      if (connectedPeers[0]?.open) {
        addLog("Sending TRIGGER to Host");
        connectedPeers[0].send({ type: "TRIGGER" });
      } else {
        addLog("Cannot send trigger: Host disconnected");
      }
    }
  }, [isHost, connectedPeers, handleTriggerInternal, addLog]);

  const handleArm = () => {
    addLog("Manual Arm -> Enabling torch and starting calibration");
    reset();
    setAppState(AppState.CALIBRATING);

    // Clear previous samples
    calibrationSamplesRef.current.clear();

    if (isHost) {
      // Broadcast CALIBRATING to peers (they can show a spinner or "Wait" state)
      broadcast({
        type: "STATE_SYNC",
        payload: {
          state: AppState.CALIBRATING,
          startTime: null,
          splits: [],
          elapsedOffset: 0,
        },
      });

      // Set timeout to finish calibration (allow 500ms for torch to stabilize, then 3s calibration)
      if (calibrationTimerRef.current)
        clearTimeout(calibrationTimerRef.current);

      calibrationTimerRef.current = setTimeout(() => {
        addLog("Calibration Complete. Calculating Averages...");

        // Calculate averages
        setConnectedDevices((prev) =>
          prev.map((device) => {
            const samples =
              calibrationSamplesRef.current.get(device.peerId) || [];
            let avg = 0;
            if (samples.length > 0) {
              const sum = samples.reduce((a, b) => a + b, 0);
              avg = Math.round(sum / samples.length);
            }
            addLog(
              `Device ${device.name}: ${samples.length} samples, Avg Latency: ${avg}ms`
            );
            return { ...device, avgLatency: avg };
          })
        );

        // Transition to ARMED
        setAppState(AppState.ARMED);
        broadcast({
          type: "STATE_SYNC",
          payload: {
            state: AppState.ARMED,
            startTime: null,
            splits: [],
            elapsedOffset: 0,
          },
        });
      }, 3500); // 500ms torch stabilization + 3000ms calibration
    } else {
      // If not host (standalone mode), wait 500ms for torch stabilization then 1s for effect then arm
      setTimeout(() => {
        setAppState(AppState.ARMED);
      }, 1500); // 500ms torch + 1000ms wait
    }
  };

  const handleReset = () => {
    addLog("Manual Reset -> Broadcasting");
    if (calibrationTimerRef.current) clearTimeout(calibrationTimerRef.current);
    stop();
    setAppState(AppState.IDLE);
    reset();

    if (isHost) {
      broadcast({
        type: "STATE_SYNC",
        payload: {
          state: AppState.IDLE,
          startTime: null,
          splits: [],
          elapsedOffset: 0,
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-3 md:p-4 font-sans relative flex flex-col">
      <PWAUpdateNotification />

      <DebugConsole
        logs={logs}
        isOpen={showDebug}
        onClose={() => setShowDebug(false)}
        onClear={() => setLogs([])}
      />

      <header className="mb-4 flex justify-between items-center border-b border-blue-900/50 pb-3 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            SPRINT<span className="text-blue-300/80 font-medium">GATES</span>
          </h1>
          <p className="text-[10px] text-blue-500/60 tracking-widest">
            OPTICAL TIMING
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-[9px] bg-blue-950/80 hover:bg-blue-900/80 px-2 py-1 rounded-md text-blue-400 border border-blue-800/50 transition-all"
            >
              {showDebug ? "HIDE" : "LOG"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout - 1/4 Video, 3/4 UI */}
      <main className="flex flex-col h-screen max-w-lg mx-auto w-full pb-6">
        {/* 1. Video Feed - 1/4 of screen height */}
        <div className="h-[25vh] relative rounded-xl overflow-hidden border border-blue-800/40 bg-gray-900 shadow-2xl shadow-blue-950/50 mb-3 flex-shrink-0">
          <BarrierCam
            appState={appState}
            onTrigger={handleTrigger}
            onArm={handleArm}
            onReset={handleReset}
            settings={settings}
            onSettingsChange={setSettings}
            addLog={addLog}
            peerId={peerId}
            hostCode={hostCode}
            connectionStatus={connectionStatus}
            isHost={isHost}
            connectedDevices={connectedDevices}
            onJoin={joinSession}
            onHost={startHosting}
          />
        </div>

        {/* 2. Rest of UI - remaining screen height */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
          {/* Timer Display */}
          <div className="shrink-0">
            <TimerDisplay elapsedMs={elapsed} state={appState} />
          </div>

          {/* Splits List (Collapsible) */}
          <SplitsList splits={splits} />
        </div>
      </main>
    </div>
  );
};

export default App;
