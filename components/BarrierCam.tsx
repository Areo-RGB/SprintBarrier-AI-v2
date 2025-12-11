import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AppState, DetectionSettings } from '../types';

interface BarrierCamProps {
  appState: AppState;
  onTrigger: () => void;
  settings: DetectionSettings;
  addLog?: (msg: string) => void; // Optional logger injection
}

export const BarrierCam: React.FC<BarrierCamProps> = ({ appState, onTrigger, settings, addLog }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [streamError, setStreamError] = useState<string | null>(null);
  const [visualActivity, setVisualActivity] = useState(0);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  // Refs for loop stability
  // Store previous pixels for 3 distinct zones
  const prevPixelsRef = useRef<(Uint8ClampedArray | null)[]>([null, null, null]);
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
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { onTriggerRef.current = onTrigger; }, [onTrigger]);
  useEffect(() => { addLogRef.current = addLog; }, [addLog]);

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
                frameRate: { ideal: 60 }
              }
            : {
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 60 }
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
        stream?.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }
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
        const hasTorch = !!capabilities.torch || ('torch' in capabilities);

        if (hasTorch) {
            const turnOn = settings.torchEnabled && appState === AppState.ARMED;
            try {
                await track.applyConstraints({
                    // @ts-ignore
                    advanced: [{ torch: turnOn }]
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

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
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
    const clampedX = Math.max(size/2, Math.min(centerX, canvas.width - size/2));
    const x = clampedX - size/2;

    // Define 3 vertical positions fixed at 25%, 50%, 75% height
    const yPositions = [
        Math.floor(canvas.height * 0.25) - size/2,
        Math.floor(canvas.height * 0.50) - size/2,
        Math.floor(canvas.height * 0.75) - size/2
    ];

    // Update Drag Area: Covers the entire vertical strip from top box to bottom box
    lastRectRef.current = { 
        x: x, 
        y: yPositions[0], 
        w: size, 
        h: (yPositions[2] + size) - yPositions[0] 
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
            diffScore += (rDiff + gDiff + bDiff);
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
    const threshold = Math.max(5, 155 - (currentSettings.sensitivity * 1.5));
    const isTriggered = scores.every(s => s > threshold);
    const now = Date.now();
    
    if ((currentState === AppState.ARMED || currentState === AppState.RUNNING) && isTriggered) {
        if (now - lastTriggerTimeRef.current > 500) {
            lastTriggerTimeRef.current = now;
            addLogRef.current?.(`Motion detected (Triple Beam). State: ${currentState}`);
            onTriggerRef.current();
        }
    }

    // --- Visuals ---
    
    // Base Color
    let baseColor = '255, 255, 255'; // White
    if (currentState === AppState.ARMED) baseColor = '239, 68, 68'; // Red
    else if (currentState === AppState.RUNNING) baseColor = '52, 211, 153'; // Emerald
    
    if (isDraggingRef.current) baseColor = '255, 255, 0'; // Yellow

    ctx.strokeStyle = `rgba(${baseColor}, 0.9)`;
    ctx.lineWidth = 2;

    // Draw connecting line (beam pole)
    ctx.beginPath();
    ctx.moveTo(clampedX, yPositions[0] + size/2);
    ctx.lineTo(clampedX, yPositions[2] + size/2);
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
        y: 0 // Y drag is disabled
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
      y: 0.5
    };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-full bg-black rounded-2xl overflow-hidden shadow-lg border border-gray-800 group"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none', cursor: isCameraEnabled ? 'col-resize' : 'default' }}
    >
      {streamError && isCameraEnabled && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 p-4 text-center z-10 pointer-events-none">
          {streamError}
        </div>
      )}

      {!isCameraEnabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-4 text-center z-10 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2 opacity-50">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            <span className="text-sm font-mono uppercase tracking-widest">Camera Disabled</span>
        </div>
      )}
      
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${isCameraEnabled ? 'opacity-80' : 'opacity-0'}`}
      />
      
      <canvas 
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none ${isCameraEnabled ? 'opacity-100' : 'opacity-0'}`}
      />

      <button 
        onClick={(e) => {
            e.stopPropagation(); 
            setIsCameraEnabled(!isCameraEnabled);
        }}
        className="absolute top-4 left-4 z-20 bg-black/50 hover:bg-black/80 backdrop-blur-md p-2 rounded-full text-white transition-all border border-white/10"
        title={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
      >
        {isCameraEnabled ? (
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
             <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
           </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-500">
             <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.045 9.72c.122-.163.266-.317.429-.46 1.326-1.163 3.525-.262 3.525 1.604v7.288c0 1.866-2.199 2.768-3.525 1.604-.37-.325-.664-.714-.871-1.144L5.226 2.296A3.002 3.002 0 017.5 2h9.75a3 3 0 013.001 3v2.855l1.794 1.865z" />
             <path d="M12.006 13.918l-3.32-3.453a2.978 2.978 0 00-.916-2.227 3.003 3.003 0 00-2.32-.835L2.3 8.599a3 3 0 00-.8 2.15V15.5a3 3 0 003 3h10.999a3 3 0 00.932-.15l-4.425-4.432z" />
            </svg>
        )}
      </button>

      {isCameraEnabled && (
        <div className="absolute top-4 right-4 bg-black/50 px-2 py-1 rounded text-xs text-green-400 font-mono pointer-events-none select-none">
            Act: {visualActivity.toFixed(1)}
        </div>
      )}

      {isCameraEnabled && (
        <div className="absolute bottom-4 left-0 w-full flex justify-center pointer-events-none select-none">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-medium border border-white/10">
                DRAG VERTICAL BARRIER
            </div>
        </div>
      )}
    </div>
  );
};