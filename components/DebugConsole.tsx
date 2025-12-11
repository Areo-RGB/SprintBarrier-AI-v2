import React, { useRef, useEffect } from "react";

interface DebugConsoleProps {
  logs: string[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({
  logs,
  isOpen,
  onClose,
  onClear,
}) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join("\n"));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-1/3 bg-gray-950/98 border-t-2 border-blue-700/50 z-50 flex flex-col text-xs shadow-2xl backdrop-blur-sm">
      <div className="flex justify-between items-center p-2 bg-blue-950/80 border-b border-blue-800/50">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold text-[10px] tracking-wider">
            SYSTEM LOGS
          </span>
          <span className="text-blue-600 text-[9px]">
            {logs.length} entries
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleCopy}
            className="px-2 py-1 bg-blue-900/60 hover:bg-blue-800/60 rounded text-blue-300 font-bold text-[9px] border border-blue-700/40 transition-colors"
          >
            COPY
          </button>
          <button
            onClick={onClear}
            className="px-2 py-1 bg-blue-900/60 hover:bg-blue-800/60 rounded text-blue-300 font-bold text-[9px] border border-blue-700/40 transition-colors"
          >
            CLEAR
          </button>
          <button
            onClick={onClose}
            className="px-2 py-1 bg-red-950/60 hover:bg-red-900/60 text-red-400 rounded font-bold text-[9px] border border-red-700/40 transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 text-blue-200">
        {logs.map((log, i) => (
          <div
            key={i}
            className="border-b border-blue-900/30 pb-0.5 mb-0.5 break-all hover:bg-blue-950/50 px-1 rounded"
          >
            <span className="text-blue-600 mr-2 opacity-60 select-none text-[9px]">
              {log.split("]")[0]}]
            </span>
            <span
              className={
                log.includes("ERROR")
                  ? "text-red-400"
                  : log.includes("TRIGGER")
                  ? "text-amber-400"
                  : "text-blue-300"
              }
            >
              {log.split("]").slice(1).join("]")}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};
