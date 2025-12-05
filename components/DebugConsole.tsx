import React, { useRef, useEffect } from 'react';

interface DebugConsoleProps {
  logs: string[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({ logs, isOpen, onClose, onClear }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-1/3 bg-black/95 border-t border-gray-700 z-50 flex flex-col font-mono text-xs shadow-2xl">
      <div className="flex justify-between items-center p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">SYSTEM LOGS</span>
            <span className="text-gray-500 text-[10px]">{logs.length} entries</span>
        </div>
        <div className="flex gap-2">
            <button onClick={handleCopy} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white font-bold text-[10px]">COPY</button>
            <button onClick={onClear} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white font-bold text-[10px]">CLEAR</button>
            <button onClick={onClose} className="px-3 py-1 bg-gray-700 hover:bg-red-900/50 text-red-400 rounded font-bold text-[10px]">CLOSE</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1 text-gray-300 font-mono">
        {logs.map((log, i) => (
            <div key={i} className="border-b border-gray-800/50 pb-0.5 mb-0.5 break-all hover:bg-gray-900/50">
                <span className="text-gray-500 mr-2 opacity-50 select-none">{log.split(']')[0]}]</span>
                <span className={log.includes('ERROR') ? 'text-red-400' : (log.includes('TRIGGER') ? 'text-yellow-400' : 'text-gray-300')}>
                    {log.split(']').slice(1).join(']')}
                </span>
            </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};