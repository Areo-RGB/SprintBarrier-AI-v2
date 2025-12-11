# SprintBarrier AI - Feature Specification

## Overview
SprintBarrier AI is a software-based alternative to hardware optical timing gates used in athletics. It leverages device cameras and computer vision to create a "virtual tripwire" that detects motion to start, split, and stop a high-precision sprint timer. The system supports multi-device synchronization, allowing one device to act as a display/host and others to act as remote sensor gates.

## Core Features

### 1. Optical Detection Engine
*   **Virtual Triple Beam Gate:** The system simulates a professional triple-beam hardware gate. It projects three vertically stacked sensing zones onto the camera feed.
*   **Simultaneous Trigger Logic:** To prevent false positives (e.g., a hand waving), the system requires all three zones to detect motion simultaneously to register a valid trigger event.
*   **Visual Feedback:**
    *   **Augmented Reality Overlay:** Displays the sensing zones and a connecting "virtual pole" over the live camera feed.
    *   **Real-time Activity Indicators:** Visual highlights on individual sensor boxes when motion is detected, even if the threshold for a full trigger hasn't been met.
    *   **State-based Color Coding:** Visuals change color based on system state (e.g., Red for Armed, Green for Running).
*   **Interactive Positioning:** Users can drag the virtual barrier horizontally across the screen to align with a physical finish line or marker.
*   **Environmental Adaptability:**
    *   **Sensitivity Control:** Adjustable threshold to account for varying background noise or lighting conditions.
    *   **Torch/Flashlight Control:** Automated control of the device's flashlight to ensure consistent lighting on the detection subject when the system is armed.

### 2. Precision Timing
*   **Stopwatch Functionality:** Millisecond-precision timer supporting Start, Stop, and Reset operations.
*   **Split Timing:** Capable of recording multiple split times as the subject passes the camera or additional remote cameras.
*   **Debouncing:** Logic to prevent double-triggering caused by the same athlete moving slowly through the frame.

### 3. Multi-Device Ecosystem
*   **Host/Client Architecture:**
    *   **Host:** Maintains the "source of truth" for the timer, manages the session, and displays the main time.
    *   **Client (Sensor):** Connects to the host to send trigger signals remotely. Acts effectively as a remote start or split gate.
*   **Network Latency Compensation:** The system measures the round-trip time (RTT) between devices. When a remote device triggers the timer, the host calculates the network delay and subtracts it from the timestamp to ensure the recorded time reflects the exact moment physical motion occurred, not when the data packet arrived.
*   **State Synchronization:** The Host broadcasts the application state (Idle, Armed, Running) to all connected clients, ensuring UI consistency across the field.

### 4. User Interface & Experience
*   **Athletic/Cyberpunk Aesthetic:** High-contrast, dark-mode interface designed for readability in outdoor environments.
*   **Data Presentation:**
    *   Large, tabular-nums timer display.
    *   Collapsible list of split times showing the cumulative time and the differential (gap) between splits.
*   **Connection Management:** A dedicated panel for generating session codes (Host) and entering codes to pair devices (Client).
*   **Debug Tools:** Built-in console logging for troubleshooting detection sensitivity and network message passing.

## User Workflow
1.  **Setup:** Device is placed on the track side. The user aligns the camera so the virtual barrier matches the finish line.
2.  **Connection (Optional):** Additional devices are paired via a short code to act as remote sensors.
3.  **Calibration:** The system performs a network latency test (if connected) to calculate offset values.
4.  **Arming:** The user "Arms" the system. The camera flashlight activates (if enabled), and the detection engine begins monitoring the triple-beam zones.
5.  **Execution:**
    *   **Start:** Motion crossing the barrier triggers the timer start (compensated for latency).
    *   **Splits:** Subsequent crossings record split times.
6.  **Review:** The timer is stopped, and split data can be reviewed in the collapsible list.
