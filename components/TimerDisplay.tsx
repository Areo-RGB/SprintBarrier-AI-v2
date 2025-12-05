import React from 'react';

interface TimerDisplayProps {
  elapsedMs: number;
  state: string;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ elapsedMs, state }) => {
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10); // Display 2 digits

    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    const msStr = milliseconds.toString().padStart(2, '0');

    return `${mm}:${ss}.${msStr}`;
  };

  const getStatusColor = () => {
    switch (state) {
      case 'ARMED': return 'text-red-500 animate-pulse';
      case 'RUNNING': return 'text-green-400';
      case 'FINISHED': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

      <div className={`text-6xl md:text-8xl lg:text-9xl font-mono font-bold tracking-tighter tabular-nums ${getStatusColor()} transition-colors duration-300 z-10`}>
        {formatTime(elapsedMs)}
      </div>
      <div className="mt-4 text-gray-500 uppercase tracking-widest text-sm font-semibold z-10">
        {state === 'IDLE' ? 'Ready to Arm' : state}
      </div>
    </div>
  );
};