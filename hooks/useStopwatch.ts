import { useState, useRef, useCallback, useEffect } from 'react';
import { Split } from '../types';

export const useStopwatch = () => {
  const [elapsed, setElapsed] = useState(0);
  const [splits, setSplits] = useState<Split[]>([]);
  
  const startTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  
  // Used for calculating split diffs
  const lastSplitTimeRef = useRef<number>(0);

  const update = useCallback(() => {
    if (startTimeRef.current !== null) {
      const now = Date.now();
      setElapsed(now - startTimeRef.current);
      rafIdRef.current = requestAnimationFrame(update);
    }
  }, []);

  const start = useCallback((timestamp?: number) => {
    if (startTimeRef.current !== null) return; // Already running
    
    // If timestamp provided (from host), use it. Otherwise use now.
    const startT = timestamp || Date.now();
    startTimeRef.current = startT;
    lastSplitTimeRef.current = 0;
    
    rafIdRef.current = requestAnimationFrame(update);
  }, [update]);

  const stop = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Final update
    if (startTimeRef.current !== null) {
      setElapsed(Date.now() - startTimeRef.current);
    }
    // Don't nullify startTimeRef yet if we want to show the time, 
    // but usually stop means we are done. 
    // We keep startTimeRef to allow resuming if needed, but for this app "Stop" is usually "Finish".
    startTimeRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    startTimeRef.current = null;
    lastSplitTimeRef.current = 0;
    setElapsed(0);
    setSplits([]);
  }, []);

  const recordSplit = useCallback((remoteElapsedTime?: number) => {
    // If remoteElapsedTime is passed, trust the host's time
    const currentElapsed = remoteElapsedTime ?? (startTimeRef.current ? Date.now() - startTimeRef.current : 0);
    
    // Avoid duplicate splits too close together (debounce)
    if (splits.length > 0 && currentElapsed - splits[splits.length - 1].time < 100) return;

    const diff = currentElapsed - lastSplitTimeRef.current;
    lastSplitTimeRef.current = currentElapsed;

    const newSplit: Split = {
      id: Date.now(),
      time: currentElapsed,
      diff: diff
    };

    setSplits(prev => [...prev, newSplit]);
    return newSplit;
  }, [splits]);

  // Sync state from host
  const syncState = useCallback((elapsedTime: number, existingSplits: Split[], isRunning: boolean) => {
    setSplits(existingSplits);
    if (existingSplits.length > 0) {
        lastSplitTimeRef.current = existingSplits[existingSplits.length - 1].time;
    } else {
        lastSplitTimeRef.current = 0;
    }

    if (isRunning) {
        // Calculate what the start time SHOULD be based on current elapsed
        startTimeRef.current = Date.now() - elapsedTime;
        if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(update);
        }
    } else {
        // Just set the static time
        setElapsed(elapsedTime);
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        startTimeRef.current = null;
    }
  }, [update]);

  return { elapsed, splits, start, stop, reset, recordSplit, syncState };
};