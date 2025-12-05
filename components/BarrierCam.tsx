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

  // Refs for loop stability (These allow us to access latest props without restarting the loop)
  const prevPixelsRef = useRef<Uint8ClampedArray | null>(null);
  const requestRef = useRef<number>();
  const settingsRef = useRef(settings);
  const appStateRef = useRef(appState);
  const onTriggerRef = useRef(onTrigger);
  const addLogRef = useRef(addLog);
  
  // Trigger cooldown to prevent network flooding and double counting on a single pass
  const lastTriggerTimeRef = useRef<number>(0);

  // Position state refs
  const posRef = useRef({ x: 0.5, y: 0.5 }); // Normalized 0-1 position
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const lastRectRef = useRef({ x: 0, y: 0, w: 0, h: 0 }); // Canvas pixels

  // Sync refs to props on every render
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 60 }
          },
          audio: false,
        });
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
      // Clean up if disabled
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
  }, [isCameraEnabled]);

  // Main Loop
  const processFrame = useCallback(() => {
    if (!isCameraEnabled) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;
    
    // If video is not playing/ready, try again next frame
    if (video.readyState !== 4 || video.paused || video.ended) {
       requestRef.current = requestAnimationFrame(processFrame);
       return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Match canvas to video dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Current State values from Refs
    const currentSettings = settingsRef.current;
    const currentState = appStateRef.current;

    // --- Detection Logic ---
    
    // Calculate square box based on posRef (normalized)
    // Size is 10% of min dimension
    const size = Math.floor(Math.min(canvas.width, canvas.height) * 0.1); 
    
    // Calculate top-left based on center position
    let x = Math.floor((posRef.current.x * canvas.width) - (size / 2));
    let y = Math.floor((posRef.current.y * canvas.height) - (size / 2));

    // Clamp to bounds
    const maxX = canvas.width - size;
    const maxY = canvas.height - size;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    // Update last rect for hit testing
    lastRectRef.current = { x, y, w: size, h: size };
    
    // Get pixel data for the square
    const imageData = ctx.getImageData(x, y, size, size);
    const data = imageData.data;
    
    let diffScore = 0;

    if (prevPixelsRef.current && prevPixelsRef.current.length === data.length) {
      const prevData = prevPixelsRef.current;
      
      // Calculate difference (Skip alpha channel +4)
      for (let i = 0; i < data.length; i += 4) {
        const rDiff = Math.abs(data[i] - prevData[i]);
        const gDiff = Math.abs(data[i + 1] - prevData[i + 1]);
        const bDiff = Math.abs(data[i + 2] - prevData[i + 2]);
        diffScore += (rDiff + gDiff + bDiff);
      }
    }

    // Update reference frame
    prevPixelsRef.current = new Uint8ClampedArray(data);

    // Normalize score
    const pixelCount = (size * size);
    const normalizedScore = diffScore / pixelCount;
    
    setVisualActivity(normalizedScore);

    // Trigger Logic
    const threshold = Math.max(5, 155 - (currentSettings.sensitivity * 1.5));
    const now = Date.now();
    
    // Allow triggers in ARMED (Start) and RUNNING (Split)
    if ((currentState === AppState.ARMED || currentState === AppState.RUNNING) && normalizedScore > threshold) {
        // Debounce 500ms
        if (now - lastTriggerTimeRef.current > 500) {
            lastTriggerTimeRef.current = now;
            addLogRef.current?.(`Motion detected (Score: ${normalizedScore.toFixed(0)} > ${threshold.toFixed(0)}). State: ${currentState}`);
            // Call the ref function to avoid dependency changes restarting the loop
            onTriggerRef.current();
        }
    }

    // --- Drawing Visuals ---
    
    ctx.lineWidth = 2; 
    
    if (currentState === AppState.ARMED) {
       ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // Red-500
       ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    } else if (currentState === AppState.RUNNING) {
       ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)'; // Emerald-400
       ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
    } else {
       ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // White
       ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    }
    
    // Highlight if dragging
    if (isDraggingRef.current) {
        ctx.strokeStyle = 'rgba(255, 255, 0, 1.0)';
        ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
        ctx.lineWidth = 3;
    }

    ctx.strokeRect(x, y, size, size);
    ctx.fillRect(x, y, size, size);

    // Crosshairs
    const crossSize = size / 2 + 4; 
    ctx.beginPath();
    
    // Horizontal
    ctx.moveTo(x + size/2 - crossSize, y + size/2);
    ctx.lineTo(x + size/2 + crossSize, y + size/2);
    
    // Vertical
    ctx.moveTo(x + size/2, y + size/2 - crossSize);
    ctx.lineTo(x + size/2, y + size/2 + crossSize);
    
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glow effect
    if (currentState === AppState.ARMED || currentState === AppState.RUNNING || isDraggingRef.current) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = isDraggingRef.current ? '#FFFF00' : (currentState === AppState.ARMED ? '#EF4444' : '#34D399');
        ctx.strokeRect(x, y, size, size);
        ctx.restore();
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [isCameraEnabled]); // Reduced dependencies to just camera state

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

    const { x, y, w, h } = lastRectRef.current;

    // Hit test with generous padding
    const padding = 20;
    if (
      canvasX >= x - padding && 
      canvasX <= x + w + padding &&
      canvasY >= y - padding && 
      canvasY <= y + h + padding
    ) {
      isDraggingRef.current = true;
      // Store offset of pointer from center of box to avoid jumping
      dragOffsetRef.current = {
        x: posRef.current.x - relX,
        y: posRef.current.y - relY
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    // Update position with offset
    posRef.current = {
      x: Math.max(0, Math.min(1, relX + dragOffsetRef.current.x)),
      y: Math.max(0, Math.min(1, relY + dragOffsetRef.current.y))
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
        style={{ touchAction: 'none', cursor: isCameraEnabled ? 'crosshair' : 'default' }}
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
      
      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${isCameraEnabled ? 'opacity-80' : 'opacity-0'}`}
      />
      
      {/* Analysis Overlay - Only visible if camera is on */}
      <canvas 
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none ${isCameraEnabled ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Toggle Camera Button */}
      <button 
        onClick={(e) => {
            e.stopPropagation(); // Prevent drag interference
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

      {/* Activity Indicator (Debug) */}
      {isCameraEnabled && (
        <div className="absolute top-4 right-4 bg-black/50 px-2 py-1 rounded text-xs text-green-400 font-mono pointer-events-none select-none">
            Act: {visualActivity.toFixed(1)}
        </div>
      )}

      {isCameraEnabled && (
        <div className="absolute bottom-4 left-0 w-full flex justify-center pointer-events-none select-none">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-medium border border-white/10">
                DRAG ZONE TO POSITION
            </div>
        </div>
      )}
    </div>
  );
};