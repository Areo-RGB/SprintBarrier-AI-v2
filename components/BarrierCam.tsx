import React, { useRef, useEffect, useState, useCallback } from "react";
import { AppState, DetectionSettings, ConnectedDevice } from "../types";
import { SettingsOverlay } from "./SettingsOverlay";
import { ConnectionOverlay, ConnectionStatus } from "./ConnectionOverlay";

interface BarrierCamProps {
  appState: AppState;
  onTrigger: () => void;
  settings: DetectionSettings;
  onSettingsChange: (settings: DetectionSettings) => void;
  addLog?: (msg: string) => void;
  // Connection props
  peerId: string | null;
  hostCode: string | null;
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  connectedDevices: ConnectedDevice[];
  onJoin: (code: string) => void;
  onHost: () => void;
}

export const BarrierCam: React.FC<BarrierCamProps> = ({
  appState,
  onTrigger,
  settings,
  onSettingsChange,
  addLog,
  peerId,
  hostCode,
  connectionStatus,
  isHost,
  connectedDevices,
  onJoin,
  onHost,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [streamError, setStreamError] = useState<string | null>(null);
  const [visualActivity, setVisualActivity] = useState(0);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConnectionOpen, setIsConnectionOpen] = useState(false);

  // Refs for loop stability
  // Store previous pixels for 3 distinct zones
  const prevPixelsRef = useRef<(Uint8ClampedArray | null)[]>([
    null,
    null,
    null,
  ]);
  const requestRef = useRef<number>();
  const settingsRef = useRef(settings);
  const appStateRef = useRef(appState);
  const onTriggerRef = useRef(onTrigger);
  const addLogRef = useRef(addLog);

  // Trigger cooldown
  const lastTriggerTimeRef = useRef<number>(0);

  // Position state refs
  const posRef = useRef({ x: 0.5, y: 0.5 }); // We only use x effectively for the column
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const lastRectRef = useRef({ x: 0, y: 0, w: 0, h: 0 }); // Bounding box of the detector column

  // Sync refs to props
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  // Initialize Camera
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const startCamera = async () => {
      if (!isCameraEnabled) return;

      try {
        const constraints: MediaStreamConstraints = {
          video: settings.cameraDeviceId
            ? {
                deviceId: { exact: settings.cameraDeviceId },
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 60 },
              }
            : {
                facingMode: "environment",
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 60 },
              },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamError(null);
        }
        addLogRef.current?.("Camera initialized successfully");
      } catch (err) {
        setStreamError("Camera access denied or unavailable.");
        addLogRef.current?.(`Camera Error: ${err}`);
        console.error(err);
      }
    };

    if (isCameraEnabled) {
      startCamera();
    } else {
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraEnabled, settings.cameraDeviceId]);

  // Torch Management
  useEffect(() => {
    const applyTorch = async () => {
      if (!videoRef.current || !isCameraEnabled) return;

      const stream = videoRef.current.srcObject as MediaStream;
      if (!stream) return;

      const track = stream.getVideoTracks()[0];
      if (!track) return;

      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      // @ts-ignore
      const hasTorch = !!capabilities.torch || "torch" in capabilities;

      if (hasTorch) {
        const turnOn =
          settings.torchEnabled &&
          (appState === AppState.CALIBRATING || appState === AppState.ARMED);
        try {
          await track.applyConstraints({
            // @ts-ignore
            advanced: [{ torch: turnOn }],
          });
        } catch (e) {
          // Ignore torch errors
        }
      }
    };

    applyTorch();
  }, [appState, settings.torchEnabled, isCameraEnabled]);

  // Main Loop
  const processFrame = useCallback(() => {
    if (!isCameraEnabled) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    if (video.readyState !== 4 || video.paused || video.ended) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const currentSettings = settingsRef.current;
    const currentState = appStateRef.current;

    // --- Detection Layout (Triple Beam) ---
    // Size is smaller to be more precise: 8% of min dimension
    const size = Math.floor(Math.min(canvas.width, canvas.height) * 0.08);

    // Calculate horizontal position based on user drag
    const centerX = Math.floor(posRef.current.x * canvas.width);
    // Clamp to screen
    const clampedX = Math.max(
      size / 2,
      Math.min(centerX, canvas.width - size / 2)
    );
    const x = clampedX - size / 2;

    // Define 3 vertical positions fixed at 25%, 50%, 75% height
    const yPositions = [
      Math.floor(canvas.height * 0.25) - size / 2,
      Math.floor(canvas.height * 0.5) - size / 2,
      Math.floor(canvas.height * 0.75) - size / 2,
    ];

    // Update Drag Area: Covers the entire vertical strip from top box to bottom box
    lastRectRef.current = {
      x: x,
      y: yPositions[0],
      w: size,
      h: yPositions[2] + size - yPositions[0],
    };

    // Check all 3 zones
    const scores: number[] = [];
    const pixelCount = size * size;

    yPositions.forEach((y, index) => {
      const imageData = ctx.getImageData(x, y, size, size);
      const data = imageData.data;
      let diffScore = 0;

      const prevData = prevPixelsRef.current[index];

      if (prevData && prevData.length === data.length) {
        for (let i = 0; i < data.length; i += 4) {
          const rDiff = Math.abs(data[i] - prevData[i]);
          const gDiff = Math.abs(data[i + 1] - prevData[i + 1]);
          const bDiff = Math.abs(data[i + 2] - prevData[i + 2]);
          diffScore += rDiff + gDiff + bDiff;
        }
      }

      // Update history for this zone
      prevPixelsRef.current[index] = new Uint8ClampedArray(data);
      scores.push(diffScore / pixelCount);
    });

    // Display average activity
    const avgScore = scores.reduce((a, b) => a + b, 0) / 3;
    setVisualActivity(avgScore);

    // Trigger Logic: ALL zones must exceed threshold (AND logic)
    const threshold = Math.max(5, 155 - currentSettings.sensitivity * 1.5);
    const isTriggered = scores.every((s) => s > threshold);
    const now = Date.now();

    if (
      (currentState === AppState.ARMED || currentState === AppState.RUNNING) &&
      isTriggered
    ) {
      if (now - lastTriggerTimeRef.current > 500) {
        lastTriggerTimeRef.current = now;
        addLogRef.current?.(
          `Motion detected (Triple Beam). State: ${currentState}`
        );
        onTriggerRef.current();
      }
    }

    // --- Visuals ---

    // Base Color - Blue theme
    let baseColor = "96, 165, 250"; // Blue-400
    if (currentState === AppState.ARMED) baseColor = "248, 113, 113"; // Red-400
    else if (currentState === AppState.RUNNING) baseColor = "34, 211, 238"; // Cyan-400

    if (isDraggingRef.current) baseColor = "251, 191, 36"; // Amber-400

    ctx.strokeStyle = `rgba(${baseColor}, 0.9)`;
    ctx.lineWidth = 2;

    // Draw connecting line (beam pole)
    ctx.beginPath();
    ctx.moveTo(clampedX, yPositions[0] + size / 2);
    ctx.lineTo(clampedX, yPositions[2] + size / 2);
    ctx.stroke();

    // Draw 3 boxes
    yPositions.forEach((y, i) => {
      const isHot = scores[i] > threshold;

      // Individual box feedback
      if (isHot) {
        ctx.fillStyle = `rgba(${baseColor}, 0.6)`;
        ctx.shadowColor = `rgb(${baseColor})`;
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = `rgba(${baseColor}, 0.1)`;
        ctx.shadowBlur = 0;
      }

      ctx.strokeRect(x, y, size, size);
      ctx.fillRect(x, y, size, size);

      // Reset shadow for next ops
      ctx.shadowBlur = 0;
    });

    // Overall Glow if triggered/armed
    if (currentState === AppState.ARMED || isDraggingRef.current) {
      // No extra glow loop needed, handled per box
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [isCameraEnabled]);

  useEffect(() => {
    if (isCameraEnabled) {
      requestRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [processFrame, isCameraEnabled]);

  // --- Drag Handling ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current || !canvasRef.current || !isCameraEnabled) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    // Convert click to canvas pixels
    const canvasX = relX * canvasRef.current.width;
    const canvasY = relY * canvasRef.current.height;

    // Use the calculated bounding box of the whole strip
    const { x, y, w, h } = lastRectRef.current;
    const padding = 30; // Generous hit area

    if (
      canvasX >= x - padding &&
      canvasX <= x + w + padding &&
      canvasY >= y - padding &&
      canvasY <= y + h + padding
    ) {
      isDraggingRef.current = true;
      dragOffsetRef.current = {
        x: posRef.current.x - relX,
        y: 0, // Y drag is disabled
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;

    // Only update X, Y is fixed
    posRef.current = {
      x: Math.max(0, Math.min(1, relX + dragOffsetRef.current.x)),
      y: 0.5,
    };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-950 rounded-xl overflow-hidden shadow-xl border border-blue-800/30 group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        touchAction: "none",
        cursor: isCameraEnabled ? "col-resize" : "default",
      }}
    >
      {streamError && isCameraEnabled && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 p-4 text-center z-10 pointer-events-none font-mono text-sm">
          {streamError}
        </div>
      )}

      {!isCameraEnabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-blue-500/60 p-4 text-center z-10 pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-10 h-10 mb-2 opacity-50"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
            />
          </svg>
          <span className="text-xs font-mono uppercase tracking-widest">
            Camera Off
          </span>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-contain bg-black pointer-events-none transition-opacity duration-500 ${
          isCameraEnabled ? "opacity-90" : "opacity-0"
        }`}
      />

      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none ${
          isCameraEnabled ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="absolute top-3 left-3 z-20 flex gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCameraEnabled(!isCameraEnabled);
          }}
          className="bg-gray-950/70 hover:bg-blue-900/70 backdrop-blur-md p-2 rounded-lg text-white transition-all border border-blue-800/40"
          title={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
        >
          {isCameraEnabled ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 text-cyan-400"
            >
              <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 text-red-400"
            >
              <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.045 9.72c.122-.163.266-.317.429-.46 1.326-1.163 3.525-.262 3.525 1.604v7.288c0 1.866-2.199 2.768-3.525 1.604-.37-.325-.664-.714-.871-1.144L5.226 2.296A3.002 3.002 0 017.5 2h9.75a3 3 0 013.001 3v2.855l1.794 1.865z" />
              <path d="M12.006 13.918l-3.32-3.453a2.978 2.978 0 00-.916-2.227 3.003 3.003 0 00-2.32-.835L2.3 8.599a3 3 0 00-.8 2.15V15.5a3 3 0 003 3h10.999a3 3 0 00.932-.15l-4.425-4.432z" />
            </svg>
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsSettingsOpen(true);
          }}
          className="bg-gray-950/70 hover:bg-blue-900/70 backdrop-blur-md p-2 rounded-lg text-blue-300 transition-all border border-blue-800/40"
          title="Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 15 15"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.67748 2.02413 3.23978 2.07312 2.95903 2.35386L2.35294 2.95996C2.0722 3.2407 2.0232 3.6784 2.23493 4.01427L2.80942 4.92561C2.62307 5.2645 2.47227 5.62594 2.36216 6.00481L1.31209 6.24287C0.924883 6.33065 0.650024 6.6748 0.650024 7.07183V7.92897C0.650024 8.32601 0.924883 8.67015 1.31209 8.75794L2.36228 8.99603C2.47246 9.375 2.62335 9.73652 2.80979 10.0755L2.2354 10.9867C2.02367 11.3225 2.07267 11.7602 2.35341 12.041L2.95951 12.6471C3.24025 12.9278 3.67795 12.9768 4.01382 12.7651L4.92506 12.1907C5.26384 12.377 5.62516 12.5278 6.0039 12.6379L6.24198 13.6881C6.32977 14.0753 6.67391 14.3502 7.07095 14.3502H7.92809C8.32512 14.3502 8.66927 14.0753 8.75705 13.6881L8.99505 12.6383C9.37411 12.5282 9.73573 12.3773 10.0748 12.1909L10.986 12.7653C11.3218 12.977 11.7595 12.928 12.0403 12.6473L12.6464 12.0412C12.9271 11.7604 12.9761 11.3227 12.7644 10.9869L12.1902 10.076C12.3768 9.73688 12.5278 9.37515 12.638 8.99596L13.6879 8.75794C14.0751 8.67015 14.35 8.32601 14.35 7.92897V7.07183C14.35 6.6748 14.0751 6.33065 13.6879 6.24287L12.6381 6.00488C12.528 5.62578 12.3771 5.26414 12.1906 4.92507L12.7648 4.01407C12.9766 3.6782 12.9276 3.2405 12.6468 2.95975L12.0407 2.35366C11.76 2.07292 11.3223 2.02392 10.9864 2.23565L10.0755 2.80989C9.73622 2.62328 9.37437 2.47229 8.99505 2.36209L8.75705 1.31231C8.66927 0.925096 8.32512 0.650238 7.92809 0.650238H7.07095ZM4.92053 3.81251C5.44724 3.44339 6.05665 3.18424 6.71543 3.06839L7.07095 1.50024H7.92809L8.28355 3.06816C8.94267 3.18387 9.5524 3.44302 10.0794 3.81224L11.4397 2.9547L12.0458 3.56079L11.1882 4.92117C11.5573 5.44798 11.8164 6.0575 11.9321 6.71638L13.5 7.07183V7.92897L11.932 8.28444C11.8162 8.94342 11.557 9.55301 11.1878 10.0798L12.0453 11.4402L11.4392 12.0462L10.0787 11.1886C9.55192 11.5576 8.94241 11.8166 8.28355 11.9323L7.92809 13.5002H7.07095L6.71543 11.932C6.0569 11.8162 5.44772 11.5572 4.92116 11.1883L3.56055 12.046L2.95445 11.4399L3.81213 10.0794C3.4431 9.55266 3.18403 8.94326 3.06825 8.2845L1.50002 7.92897V7.07183L3.06818 6.71632C3.18388 6.05765 3.44283 5.44833 3.81171 4.92165L2.95398 3.561L3.56008 2.95491L4.92053 3.81251ZM9.02496 7.50008C9.02496 8.34226 8.34223 9.02499 7.50005 9.02499C6.65786 9.02499 5.97513 8.34226 5.97513 7.50008C5.97513 6.65789 6.65786 5.97516 7.50005 5.97516C8.34223 5.97516 9.02496 6.65789 9.02496 7.50008ZM9.92496 7.50008C9.92496 8.83932 8.83929 9.92499 7.50005 9.92499C6.1608 9.92499 5.07513 8.83932 5.07513 7.50008C5.07513 6.16084 6.1608 5.07516 7.50005 5.07516C8.83929 5.07516 9.92496 6.16084 9.92496 7.50008Z"
            />
          </svg>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsConnectionOpen(true);
          }}
          className={`bg-gray-950/70 hover:bg-blue-900/70 backdrop-blur-md p-2 rounded-lg transition-all border ${
            connectionStatus === "connected"
              ? "text-cyan-400 border-cyan-500/50"
              : "text-blue-300 border-blue-800/40"
          }`}
          title="Multiplayer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            className="w-4 h-4"
          >
            <rect
              x="9"
              y="2"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 18V14C4 13.4477 4.44772 13 5 13H19C19.5523 13 20 13.4477 20 14V18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="4"
              cy="20"
              r="2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="20"
              cy="20"
              r="2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="12"
              cy="20"
              r="2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 8V18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {isCameraEnabled && (
        <div className="absolute top-3 right-3 bg-gray-950/70 backdrop-blur-md px-2 py-1 rounded-md text-[10px] text-cyan-400 font-mono pointer-events-none select-none border border-blue-800/40">
          ACT: {visualActivity.toFixed(1)}
        </div>
      )}

      {isCameraEnabled && (
        <div className="absolute bottom-3 left-0 w-full flex justify-center pointer-events-none select-none">
          <div className="bg-gray-950/70 backdrop-blur-md px-3 py-1.5 rounded-full text-blue-300 text-[10px] font-medium border border-blue-800/40 font-mono tracking-wide">
            ◄ DRAG BARRIER ►
          </div>
        </div>
      )}

      <SettingsOverlay
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />

      <ConnectionOverlay
        isOpen={isConnectionOpen}
        onClose={() => setIsConnectionOpen(false)}
        peerId={peerId}
        hostCode={hostCode}
        connectionStatus={connectionStatus}
        isHost={isHost}
        connectedDevices={connectedDevices}
        onJoin={onJoin}
        onHost={onHost}
      />
    </div>
  );
};
