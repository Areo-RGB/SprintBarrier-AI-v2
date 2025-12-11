import React, { useRef, useEffect, useState } from "react";
import { Split } from "../types";

interface SplitsListProps {
  splits: Split[];
}

export const SplitsList: React.FC<SplitsListProps> = ({ splits }) => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [splits, isOpen]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
  };

  if (splits.length === 0) return null;

  return (
    <div className="flex flex-col bg-gradient-to-b from-blue-950/40 to-gray-900 rounded-xl border border-blue-800/30 shadow-lg overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-blue-900/20 hover:bg-blue-900/40 flex justify-between items-center transition-colors focus:outline-none group"
      >
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-3.5 h-3.5 text-blue-500/60 group-hover:text-cyan-400 transition-transform duration-200 ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-blue-400/70 text-[10px] font-bold uppercase tracking-widest font-mono group-hover:text-cyan-400">
            Splits
          </h3>
        </div>
        <span className="text-[10px] text-blue-500/50 font-mono font-semibold group-hover:text-white transition-colors">
          {splits.length} REC
        </span>
      </button>

      <div
        className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${
          isOpen ? "max-h-[250px]" : "max-h-0"
        }`}
      >
        <div
          ref={scrollRef}
          className="overflow-y-auto p-2 space-y-1.5 border-t border-blue-800/30"
        >
          {splits.map((split, index) => (
            <div
              key={split.id}
              className="flex justify-between items-center p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/30 text-sm font-mono"
            >
              <span className="text-blue-500/60 w-8 text-xs font-semibold">
                #{index + 1}
              </span>
              <span className="text-white font-bold tabular-nums">
                {formatTime(split.time)}
              </span>
              <span className="text-cyan-400 text-xs font-semibold">
                +{formatTime(split.diff)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
