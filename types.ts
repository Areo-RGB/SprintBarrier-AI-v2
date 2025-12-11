export enum AppState {
  IDLE = 'IDLE',       // Camera active, waiting to be armed
  CALIBRATING = 'CALIBRATING', // Measuring network latency before arming
  ARMED = 'ARMED',     // Monitoring for motion
  RUNNING = 'RUNNING', // Timer is running
  FINISHED = 'FINISHED' // Timer stopped
}

export interface DetectionSettings {
  sensitivity: number; // 1-100
  torchEnabled: boolean;
}

export interface Split {
  id: number;
  time: number; // Elapsed time at split
  diff: number; // Time since last split (or start)
}

export type PeerMessageType = 'TRIGGER' | 'STATE_SYNC' | 'RESET' | 'ARM' | 'HELLO' | 'PING' | 'PONG';

export interface PeerMessage {
  type: PeerMessageType;
  payload?: any;
}

export interface TimerStatePayload {
  state: AppState;
  startTime: number | null;
  splits: Split[];
  elapsedOffset?: number; // For manual finished times
}

export interface ConnectedDevice {
  peerId: string;
  name: string;
  latency: number; // in ms (current)
  avgLatency: number; // in ms (calibrated average)
}