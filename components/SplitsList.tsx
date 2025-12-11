import React, { useRef, useEffect, useState } from 'react';
import { Split } from '../types';

interface SplitsListProps {
  splits: Split[];
}

export const SplitsList: React.FC<SplitsListProps> = ({ splits }) => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when list updates if it is open
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [splits, isOpen]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  if (splits.length === 0) return null;

  return (
    <div className="flex flex-col bg-gray-900 rounded-2xl border border-gray-800 shadow-xl overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-gray-800/50 hover:bg-gray-800 flex justify-between items-center transition-colors focus:outline-none group"
      >
        <div className="flex items-center gap-2">
           <svg 
             xmlns="http://www.w3.org/2000/svg" 
             viewBox="0 0 20 20" 
             fill="currentColor" 
             className={`w-4 h-4 text-gray-500 group-hover:text-emerald-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
           >
             <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
           </svg>
           <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider group-hover:text-emerald-400">Splits</h3>
        </div>
        <span className="text-xs text-gray-500 font-mono group-hover:text-white transition-colors">{splits.length} RECS</span>
      </button>

      <div className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[300px]' : 'max-h-0'}`}>
        <div ref={scrollRef} className="overflow-y-auto p-2 space-y-1 border-t border-gray-800">
          {splits.map((split, index) => (
            <div key={split.id} className="flex justify-between items-center p-2 rounded bg-gray-800/30 border border-gray-800/50 text-sm font-mono">
              <span className="text-gray-500 w-8">#{index + 1}</span>
              <span className="text-white font-bold">{formatTime(split.time)}</span>
              <span className="text-emerald-500 text-xs">+{formatTime(split.diff)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};