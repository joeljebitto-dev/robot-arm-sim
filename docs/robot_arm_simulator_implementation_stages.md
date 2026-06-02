# Robot Arm Simulator Implementation Stages

## Goal

Build a robot arm simulator using the selected architecture:

```text
MuJoCo + FastAPI backend owns simulation truth.
React + Three.js frontend renders streamed backend state.
```

The first priority is a stable, observable, testable simulation loop from backend physics to frontend rendering.

---

## Stage 0 — Project Setup

**Goal:** Create the base repository and development environment.

### Implement

```text
robot-arm-simulator/
  frontend/
  backend/
  models/
  docs/
  docker/
```

### Backend setup

- Python project
- FastAPI
- MuJoCo
- Pydantic
- Uvicorn
- Pytest

### Frontend setup

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Zustand or similar state store

### Deliverables

- Backend starts at `localhost:8000`
- Frontend starts at `localhost:5173`
- Basic health endpoint:

```http
GET /health
```

---

## Stage 1 — Robot Model Storage

**Goal:** Add one simple robot arm model first.

### Implement

```text
models/
  simple_6dof_arm/
    model.xml
    metadata.json
    meshes/
```

### `metadata.json` should define

- Robot ID
- Robot name
- Joint names
- Actuator names
- Joint limits
- End-effector body
- Visual body names
- Mesh paths

### Deliverables

- One MJCF file loads successfully in MuJoCo
- Metadata matches MuJoCo joint/body names
- No frontend rendering yet

### Acceptance criteria

- MuJoCo can load `model.xml`
- Robot has valid bodies, joints, and actuators
- Simulation can run locally for several thousand steps without NaN

---

## Stage 2 — Backend Model API

**Goal:** Let the frontend discover available robot models.

### Implement REST endpoints

```http
GET /api/models
GET /api/models/{model_id}
```

### Backend modules

```text
backend/app/storage/model_store.py
backend/app/api/routes_models.py
backend/app/schemas/robot.py
```

### Deliverables

Frontend can call:

```http
GET /api/models
```

and receive:

```json
{
  "models": [
    {
      "id": "simple_6dof_arm",
      "name": "Simple 6-DOF Arm",
      "dof": 6,
      "actuator_count": 6
    }
  ]
}
```

---

## Stage 3 — MuJoCo Runtime Core

**Goal:** Build the backend simulation engine before WebSocket or React complexity.

### Implement

```text
backend/app/simulation/mujoco_runtime.py
backend/app/simulation/sim_session.py
backend/app/simulation/session_manager.py
backend/app/simulation/state_encoder.py
```

### Core classes

```text
SessionManager
  -> creates/deletes sessions

SimSession
  -> owns MjModel + MjData
  -> applies commands
  -> steps MuJoCo
  -> encodes state

StateEncoder
  -> converts MuJoCo arrays into JSON-safe DTOs
```

### Deliverables

- Create session in Python
- Step simulation manually
- Extract:
  - `qpos`
  - `qvel`
  - `ctrl`
  - body poses
  - end-effector pose
  - simulation time

### Acceptance criteria

- Backend can create a simulation session
- Backend can step 1000+ times
- Backend can return valid state as JSON

---

## Stage 4 — Session REST API

**Goal:** Expose simulation session creation/deletion.

### Implement endpoints

```http
POST /api/sessions
DELETE /api/sessions/{session_id}
```

### Example request

```json
{
  "model_id": "simple_6dof_arm",
  "initial_qpos": [0, 0, 0, 0, 0, 0],
  "timestep": 0.002
}
```

### Example response

```json
{
  "session_id": "sim_001",
  "model_id": "simple_6dof_arm",
  "status": "created"
}
```

### Deliverables

- Frontend can create a simulation session
- Backend stores active sessions
- Backend can cleanly delete sessions

---

## Stage 5 — WebSocket Simulation API

**Goal:** Add realtime command and state streaming.

### Implement

```text
/ws/sim/{session_id}
```

### Client sends

```json
{
  "type": "START",
  "request_id": "req_001"
}
```

### Backend streams

```json
{
  "type": "STATE",
  "session_id": "sim_001",
  "sim_time": 1.234,
  "sequence": 512,
  "payload": {
    "qpos": [],
    "qvel": [],
    "ctrl": [],
    "bodies": {},
    "end_effector": {}
  }
}
```

### Deliverables

- WebSocket connects
- Backend sends initial state
- Backend supports:
  - `START`
  - `PAUSE`
  - `STEP`
  - `RESET`
  - `SET_ACTUATOR_CTRL`
  - `SET_JOINT_TARGETS`

### Acceptance criteria

- State stream runs at 30–60 Hz
- Physics can step internally at 500–1000 Hz
- Frontend does not receive every physics step

---

## Stage 6 — Frontend App Shell

**Goal:** Build the React application structure.

### Implement

```text
frontend/src/
  api/
    httpClient.ts
    simSocket.ts
  state/
    simStore.ts
    robotStore.ts
    uiStore.ts
  types/
    simulation.ts
    robot.ts
    commands.ts
  components/
```

### Frontend stores

```text
simStore
  -> sessionId
  -> latestState
  -> connectionStatus
  -> errors

robotStore
  -> selectedModelId
  -> modelMetadata
  -> visualBodies

uiStore
  -> selectedJoint
  -> activePanel
  -> cameraMode
```

### Deliverables

- Frontend lists robot models
- User selects a model
- Frontend creates a backend session
- Frontend opens WebSocket

---

## Stage 7 — 3D Robot Rendering

**Goal:** Render the robot from backend body poses.

### Implement

```text
components/viewport/
  RobotViewport.tsx
  RobotScene.tsx
  RobotBody.tsx
  FrameAxes.tsx
  EndEffectorMarker.tsx
```

### Important rule

Do **not** implement frontend forward kinematics in the MVP.

Render from MuJoCo body poses:

```text
MuJoCo body pose
  -> WebSocket STATE
  -> React Three Fiber Object3D transform
```

### Quaternion conversion

MuJoCo:

```text
[w, x, y, z]
```

Three.js:

```text
[x, y, z, w]
```

### Deliverables

- Load meshes from `metadata.json`
- Map `body_name -> Object3D`
- Apply streamed poses to meshes
- Render grid, axes, and end-effector marker

### Acceptance criteria

- Robot appears in browser
- Body transforms match backend state
- No frontend/backend pose drift

---

## Stage 8 — Simulation Controls

**Goal:** Allow the user to control the simulation.

### Implement UI components

```text
components/controls/
  SimulationControls.tsx
  JointControlPanel.tsx
  ControllerModeSelector.tsx
```

### Controls

- Start
- Pause
- Step
- Reset
- Joint sliders
- Actuator command input

### Command flow

```text
User moves slider
  -> Frontend sends SET_JOINT_TARGETS
  -> Backend validates/clamps command
  -> MuJoCo steps simulation
  -> Backend streams updated STATE
  -> Frontend renders updated robot
```

### Acceptance criteria

- Moving a joint slider changes the simulated robot
- Reset returns robot to initial pose
- Invalid joint names return structured errors

---

## Stage 9 — Telemetry Panel

**Goal:** Show useful simulation data.

### Implement

```text
components/telemetry/
  JointTelemetryTable.tsx
  EndEffectorPanel.tsx
  TimeSeriesChart.tsx
```

### Display

- Simulation time
- Sequence number
- Joint positions
- Joint velocities
- Actuator controls
- End-effector position
- End-effector quaternion

### Deliverables

- Telemetry updates from WebSocket state
- Telemetry refresh can be slower than render loop
- Basic charts optional

---

## Stage 10 — Reliability and Error Handling

**Goal:** Make the MVP robust enough for real development.

### Backend must handle

- Invalid model ID
- Invalid MJCF
- Invalid session ID
- Invalid command type
- Invalid joint name
- Invalid actuator name
- Out-of-range values
- WebSocket disconnect
- NaN simulation state

### Error response format

```json
{
  "type": "ERROR",
  "request_id": "req_005",
  "error": {
    "code": "ACTUATOR_NOT_FOUND",
    "message": "No actuator named elbow_motor_2"
  }
}
```

### Deliverables

- Structured errors
- Command validation
- Joint limit clamping
- Session cleanup
- Safe WebSocket disconnect handling

---

## Stage 11 — Observability

**Goal:** Make debugging simulation and networking issues easy.

### Add logs for

- App startup
- Model loaded
- Session created
- Session deleted
- WebSocket connected
- WebSocket disconnected
- Simulation started
- Simulation paused
- Simulation reset
- Invalid command
- Simulation instability

### Add endpoints

```http
GET /health
GET /metrics
```

### Track metrics

- Active sessions
- Connected clients
- Physics step duration
- State messages per second
- Command messages per second
- Error count

---

## Stage 12 — Testing

**Goal:** Prevent simulation and API regressions.

### Backend tests

```text
test_model_loading.py
test_session_lifecycle.py
test_state_encoder.py
test_websocket_sim.py
```

### Test cases

- Model loads
- Metadata parses
- Session creates/deletes
- Simulation steps
- State encoding works
- Joint commands clamp correctly
- Reset is deterministic
- WebSocket receives state
- Invalid commands return errors

### Frontend tests

- App renders
- Model list loads
- Session creation works
- WebSocket connection updates store
- Slider sends correct command
- Quaternion conversion works
- Telemetry updates

---

## Stage 13 — Docker and Local Deployment

**Goal:** Package the app for repeatable local runs.

### Implement

```text
docker/
  backend.Dockerfile
  frontend.Dockerfile
  nginx.conf

docker-compose.yml
```

### Services

```text
frontend
backend
nginx
```

### Local production-style URLs

```text
Frontend:  http://localhost
Backend:   http://localhost/api
WebSocket: ws://localhost/ws/sim/{session_id}
```

### Acceptance criteria

- `docker compose up` starts the full stack
- React app loads
- Backend health check passes
- WebSocket works through reverse proxy

---

## Recommended Implementation Order

| Order | Stage | Why |
|---:|---|---|
| 1 | Project setup | Establish repo and tooling |
| 2 | Robot model storage | Need a valid MuJoCo model first |
| 3 | Backend model API | Frontend needs model metadata |
| 4 | MuJoCo runtime | Core simulation logic |
| 5 | Session API | Session lifecycle |
| 6 | WebSocket API | Realtime state stream |
| 7 | Frontend app shell | Connect UI to backend |
| 8 | 3D rendering | Visualize streamed body poses |
| 9 | Controls | User can drive robot |
| 10 | Telemetry | Inspect simulation state |
| 11 | Reliability | Make MVP stable |
| 12 | Tests | Prevent regressions |
| 13 | Docker | Repeatable deployment |

---

## MVP Completion Target

The first complete milestone should be:

```text
A local React app connects to a FastAPI backend, creates a MuJoCo simulation
session, starts and pauses the simulation, controls a simple robot arm using
joint sliders, receives live body poses over WebSocket, and renders the robot
in a Three.js viewport.
```

### MVP acceptance criteria

- Backend loads one MJCF arm
- Backend runs 1000+ simulation steps without NaN
- Frontend creates a session
- WebSocket receives live `STATE` messages
- Robot body poses render in browser
- Moving a slider changes the simulated robot
- Reset returns robot to initial pose

---

## Do Not Implement Yet

Avoid these until the MVP loop is stable:

- Inverse kinematics
- Reinforcement learning
- Motion planning
- Scene editor
- URDF import
- Camera simulation
- Dataset generation
- Multi-user collaboration
- Authentication
- Binary WebSocket protocol

Those should come after the backend simulation loop, WebSocket state stream, and frontend rendering contract are stable.

---

## Summary

Implementation should proceed in this order:

```text
Setup
  -> Robot model
  -> Backend model API
  -> MuJoCo runtime
  -> Session lifecycle
  -> WebSocket state stream
  -> Frontend app shell
  -> Three.js rendering
  -> Controls
  -> Telemetry
  -> Reliability
  -> Testing
  -> Docker deployment
```

The most important milestone is not advanced robotics. The first priority is a stable backend-to-frontend simulation loop:

```text
Frontend command
  -> FastAPI WebSocket
  -> MuJoCo simulation step
  -> Backend state encoder
  -> WebSocket STATE message
  -> React Three Fiber render update
```
