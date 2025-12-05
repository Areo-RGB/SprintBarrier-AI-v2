import React, { useRef, useEffect } from 'react';
import { Split } from '../types';

interface SplitsListProps {
  splits: Split[];
}

export const SplitsList: React.FC<SplitsListProps> = ({ splits }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [splits]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  if (splits.length === 0) return null;

  return (
    <div className="flex flex-col bg-gray-900 rounded-2xl border border-gray-800 shadow-xl overflow-hidden max-h-[300px] flex-grow">
      <div className="p-3 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Splits</h3>
        <span className="text-xs text-gray-500 font-mono">{splits.length} RECS</span>
      </div>
      <div ref={scrollRef} className="overflow-y-auto p-2 space-y-1">
        {splits.map((split, index) => (
          <div key={split.id} className="flex justify-between items-center p-2 rounded bg-gray-800/30 border border-gray-800/50 text-sm font-mono">
            <span className="text-gray-500 w-8">#{index + 1}</span>
            <span className="text-white font-bold">{formatTime(split.time)}</span>
            <span className="text-emerald-500 text-xs">+{formatTime(split.diff)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};