# Robot Arm Simulator

A browser-based robot arm simulator using:

- FastAPI + MuJoCo for backend simulation
- React + TypeScript for frontend UI
- Three.js / React Three Fiber for 3D rendering

## Architecture

The backend is the source of simulation truth.

```text
Frontend command
  -> FastAPI backend
  -> MuJoCo simulation
  -> Backend state encoder
  -> WebSocket state stream
  -> React Three Fiber render update
```
