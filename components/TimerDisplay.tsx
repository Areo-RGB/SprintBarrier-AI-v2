import React from "react";

interface TimerDisplayProps {
  elapsedMs: number;
  state: string;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  elapsedMs,
  state,
}) => {
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);

    const mm = minutes.toString().padStart(2, "0");
    const ss = seconds.toString().padStart(2, "0");
    const msStr = milliseconds.toString().padStart(2, "0");

    return { mm, ss, msStr };
  };

  const getStatusColor = () => {
    switch (state) {
      case "ARMED":
        return "text-red-400 animate-pulse drop-shadow-[0_0_20px_rgba(248,113,113,0.6)]";
      case "RUNNING":
        return "text-cyan-400 drop-shadow-[0_0_25px_rgba(34,211,238,0.5)]";
      case "FINISHED":
        return "text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]";
      default:
        return "text-blue-300/70";
    }
  };

  const getStatusBg = () => {
    switch (state) {
      case "ARMED":
        return "from-red-950/30 via-gray-900 to-gray-900";
      case "RUNNING":
        return "from-cyan-950/30 via-gray-900 to-gray-900";
      case "FINISHED":
        return "from-amber-950/30 via-gray-900 to-gray-900";
      default:
        return "from-blue-950/40 via-gray-900 to-gray-900";
    }
  };

  const { mm, ss, msStr } = formatTime(elapsedMs);

  return (
    <div
      className={`flex flex-col items-center justify-center h-full bg-gradient-to-b ${getStatusBg()} rounded-xl border border-blue-800/30 shadow-xl shadow-blue-950/30 relative overflow-hidden`}
    >
      {/* Scan line effect */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(59,130,246,0.5) 2px, rgba(59,130,246,0.5) 4px)",
        }}
      ></div>

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-blue-500/40 rounded-tl-lg"></div>
      <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-blue-500/40 rounded-tr-lg"></div>
      <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-blue-500/40 rounded-bl-lg"></div>
      <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-blue-500/40 rounded-br-lg"></div>

      <div
        className={`font-mono font-bold tracking-tighter tabular-nums ${getStatusColor()} transition-all duration-300 z-10 flex items-baseline`}
      >
        <span className="text-5xl md:text-7xl">
          {mm}:{ss}
        </span>
        <span className="text-3xl md:text-5xl text-blue-400/60">.</span>
        <span className="text-3xl md:text-5xl">{msStr}</span>
      </div>
      <div className="mt-2 text-blue-400/60 uppercase tracking-[0.2em] text-[10px] font-semibold z-10 font-mono">
        {state === "IDLE" ? "● READY" : `● ${state}`}
      </div>
    </div>
  );
};
