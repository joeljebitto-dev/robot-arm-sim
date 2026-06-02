# Robot Arm Simulator Architecture

## 1. Purpose

This document defines the architecture for a robot arm simulator built with:

- **Python + MuJoCo** for backend physics simulation.
- **FastAPI** for REST and WebSocket APIs.
- **React + TypeScript** for the frontend application.
- **Three.js / React Three Fiber** for browser-side 3D rendering.

The chosen architecture is:

> **Backend simulates. Frontend renders.**

The backend is the authoritative source of simulation truth. The frontend sends user commands and renders the robot using state streamed from the backend.

---

## 2. System Goals

The simulator should allow a user to:

1. Load a robot arm model.
2. Create a simulation session.
3. Start, pause, reset, and step the simulation.
4. Control robot joints or actuators from the browser.
5. Receive live robot state over WebSocket.
6. Render the robot in 3D using body poses from MuJoCo.
7. View telemetry such as joint positions, velocities, actuator commands, and end-effector pose.
8. Later extend the simulator with IK, trajectory playback, scene editing, motion planning, and dataset generation.

---

## 3. Architectural Principles

### 3.1 Backend is authoritative

The frontend must not guess the physics state.

Correct flow:

```text
Frontend sends command
  -> Backend applies command
  -> MuJoCo steps simulation
  -> Backend streams updated state
  -> Frontend renders returned state
```

Avoid:

```text
Frontend moves robot locally
  -> Backend separately simulates
  -> Frontend and backend drift out of sync
```

---

### 3.2 Render from MuJoCo body poses

The frontend should initially render the robot using final body poses computed by MuJoCo.

The frontend should not recompute full robot forward kinematics during the MVP phase.

This avoids mismatch between:

- MuJoCo joint conventions.
- Visual mesh offsets.
- Quaternion conventions.
- Parent-child transform differences.
- Frontend kinematics implementation errors.

---

### 3.3 Body names are the rendering contract

MuJoCo body names must map directly to frontend visual bodies.

Example MJCF:

```xml
<body name="link_1">
  ...
</body>
```

Frontend metadata:

```json
{
  "body_name": "link_1",
  "mesh": "/models/simple_6dof_arm/meshes/link_1.glb"
}
```

Backend state:

```json
{
  "bodies": {
    "link_1": {
      "position": [0.0, 0.0, 0.25],
      "quat": [1.0, 0.0, 0.0, 0.0]
    }
  }
}
```

---

### 3.4 Stream compact state

The backend should stream only the state needed by the frontend.

MVP state should include:

- `qpos`
- `qvel`
- `ctrl`
- visible body poses
- end-effector pose
- simulation time
- sequence number

Avoid streaming high-volume data initially, such as:

- camera frames
- full contact arrays
- large sensor buffers
- debug logs
- mesh geometry
- every physics step

---

## 4. High-Level System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ React Frontend                                                │
│                                                              │
│  ┌──────────────────────┐   ┌──────────────────────────────┐ │
│  │ Joint Controls        │   │ 3D Robot Viewport            │ │
│  │ Sliders / Buttons     │   │ Three.js / React Three Fiber │ │
│  └──────────────────────┘   └──────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────┐   ┌──────────────────────────────┐ │
│  │ Telemetry Panel       │   │ Trajectory Timeline          │ │
│  │ qpos/qvel/ctrl        │   │ Record / Playback            │ │
│  └──────────────────────┘   └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                    │
                    │ REST + WebSocket
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ FastAPI Backend                                               │
│                                                              │
│  ┌──────────────────────┐   ┌──────────────────────────────┐ │
│  │ Session Manager       │   │ MuJoCo Runtime               │ │
│  │ Creates sim sessions  │   │ Loads and steps physics      │ │
│  └──────────────────────┘   └──────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────┐   ┌──────────────────────────────┐ │
│  │ Controller Layer      │   │ State Encoder                │ │
│  │ Applies commands      │   │ Converts MuJoCo state to DTO │ │
│  └──────────────────────┘   └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ Robot Model Storage                                           │
│ MJCF XML + mesh files + metadata.json                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Major Components

## 5.1 Frontend

The frontend is responsible for user interaction and visualization.

### Responsibilities

- Display robot models available from the backend.
- Create and connect to simulation sessions.
- Send commands over WebSocket.
- Receive live simulation state.
- Render robot body poses using Three.js / React Three Fiber.
- Display joint and actuator telemetry.
- Display end-effector pose.
- Provide camera controls, grid, axes, target markers, and trajectory visualization.
- Smoothly interpolate visual transforms if needed.

### Frontend should not

- Run MuJoCo physics.
- Authoritatively update robot state.
- Perform full forward dynamics.
- Persist simulation truth independently from the backend.

---

## 5.2 Backend

The backend is responsible for simulation, control, state, and later robotics algorithms.

### Responsibilities

- Load MJCF robot models.
- Create MuJoCo `MjModel` and `MjData`.
- Own simulation sessions.
- Step the physics engine.
- Apply actuator and joint target commands.
- Enforce command limits.
- Extract body poses from MuJoCo.
- Stream simulation state to connected frontend clients.
- Handle simulation reset, pause, play, and stepping.
- Later provide IK, trajectory generation, collision checking, and planning.

---

## 5.3 Robot Model Storage

Each robot model is stored as a folder containing:

```text
models/
  simple_6dof_arm/
    model.xml
    metadata.json
    meshes/
      base.glb
      link_1.glb
      link_2.glb
      link_3.glb
      link_4.glb
      link_5.glb
      link_6.glb
```

### `model.xml`

The MuJoCo MJCF source file.

### `metadata.json`

A frontend/backend-readable model description.

Example:

```json
{
  "id": "simple_6dof_arm",
  "name": "Simple 6-DOF Arm",
  "description": "Basic 6-DOF robot arm for simulator MVP",
  "end_effector_body": "tool0",
  "visual_bodies": [
    {
      "body_name": "base",
      "mesh": "/models/simple_6dof_arm/meshes/base.glb"
    },
    {
      "body_name": "link_1",
      "mesh": "/models/simple_6dof_arm/meshes/link_1.glb"
    }
  ]
}
```

---

## 6. Runtime Flow

## 6.1 Application startup

```text
User opens React app
  -> Frontend calls GET /api/models
  -> Backend returns available robot models
  -> User selects robot
  -> Frontend calls POST /api/sessions
  -> Backend loads MJCF and creates session
  -> Frontend opens WebSocket /ws/sim/{session_id}
  -> Backend starts sending initial state
```

---

## 6.2 Simulation control flow

```text
User presses Start
  -> Frontend sends START command
  -> Backend marks session as running
  -> Backend steps MuJoCo at fixed physics rate
  -> Backend streams state at output rate
  -> Frontend renders body poses
```

---

## 6.3 Joint control flow

```text
User moves joint slider
  -> Frontend sends SET_JOINT_TARGETS
  -> Backend validates target joint names
  -> Backend clamps values to configured joint limits
  -> Controller layer maps targets to actuators
  -> MuJoCo simulation advances
  -> Backend streams updated qpos, qvel, ctrl, and body poses
  -> Frontend updates viewport and telemetry
```

---

## 7. Timing Model

The simulator should use separate rates for physics, network streaming, and rendering.

| Layer | Recommended Rate | Notes |
|---|---:|---|
| MuJoCo physics stepping | 500–1000 Hz | Internal backend loop |
| WebSocket state streaming | 30–60 Hz | Do not stream every physics step |
| Browser rendering | 60 FPS | Driven by requestAnimationFrame |
| Telemetry charts | 10–30 Hz | Can be lower than render rate |

### Rule

The backend may step physics many times before sending a single state update.

Example:

```text
Physics timestep: 0.002 s = 500 Hz
State stream period: 0.033 s = 30 Hz

For each WebSocket state frame:
  run about 16 MuJoCo steps
  encode state
  send STATE message
```

---

## 8. API Design

## 8.1 REST API

REST is used for session lifecycle, model metadata, and non-realtime operations.

### List robot models

```http
GET /api/models
```

Response:

```json
{
  "models": [
    {
      "id": "simple_6dof_arm",
      "name": "Simple 6-DOF Arm",
      "description": "Basic serial manipulator for simulator MVP",
      "dof": 6,
      "actuator_count": 6
    }
  ]
}
```

---

### Get robot model metadata

```http
GET /api/models/{model_id}
```

Response:

```json
{
  "id": "simple_6dof_arm",
  "name": "Simple 6-DOF Arm",
  "description": "Basic serial manipulator for simulator MVP",
  "end_effector_body": "tool0",
  "joints": [
    {
      "name": "shoulder_pan",
      "type": "hinge",
      "lower": -3.14159,
      "upper": 3.14159,
      "unit": "rad"
    }
  ],
  "actuators": [
    {
      "name": "shoulder_pan_motor",
      "joint": "shoulder_pan",
      "control_type": "position",
      "ctrl_range": [-3.14159, 3.14159]
    }
  ],
  "visual_bodies": [
    {
      "body_name": "base",
      "mesh": "/models/simple_6dof_arm/meshes/base.glb"
    }
  ]
}
```

---

### Create simulation session

```http
POST /api/sessions
```

Request:

```json
{
  "model_id": "simple_6dof_arm",
  "initial_qpos": [0, 0, 0, 0, 0, 0],
  "timestep": 0.002
}
```

Response:

```json
{
  "session_id": "sim_001",
  "model_id": "simple_6dof_arm",
  "status": "created"
}
```

---

### Delete simulation session

```http
DELETE /api/sessions/{session_id}
```

Response:

```json
{
  "status": "deleted"
}
```

---

## 8.2 WebSocket API

WebSocket is used for realtime commands and state streaming.

```text
/ws/sim/{session_id}
```

---

## 9. WebSocket Message Contract

## 9.1 Client-to-backend commands

### Start simulation

```json
{
  "type": "START",
  "request_id": "req_001"
}
```

### Pause simulation

```json
{
  "type": "PAUSE",
  "request_id": "req_002"
}
```

### Step simulation manually

```json
{
  "type": "STEP",
  "request_id": "req_003",
  "payload": {
    "steps": 10
  }
}
```

### Reset simulation

```json
{
  "type": "RESET",
  "request_id": "req_004",
  "payload": {
    "qpos": [0, 0, 0, 0, 0, 0]
  }
}
```

### Set actuator control

```json
{
  "type": "SET_ACTUATOR_CTRL",
  "request_id": "req_005",
  "payload": {
    "actuator": "elbow_motor",
    "value": 0.8
  }
}
```

### Set joint targets

```json
{
  "type": "SET_JOINT_TARGETS",
  "request_id": "req_006",
  "payload": {
    "targets": {
      "shoulder_pan": 0.4,
      "shoulder_lift": -0.5,
      "elbow": 0.8
    }
  }
}
```

---

## 9.2 Backend-to-client events

### State event

```json
{
  "type": "STATE",
  "session_id": "sim_001",
  "sim_time": 1.234,
  "sequence": 512,
  "payload": {
    "qpos": [0.1, -0.3, 0.8, 0.0, 0.2, 0.0],
    "qvel": [0.0, 0.01, -0.02, 0.0, 0.0, 0.0],
    "ctrl": [0.1, -0.3, 0.8, 0.0, 0.2, 0.0],
    "bodies": {
      "base": {
        "position": [0.0, 0.0, 0.0],
        "quat": [1.0, 0.0, 0.0, 0.0]
      },
      "link_1": {
        "position": [0.0, 0.0, 0.25],
        "quat": [0.98, 0.0, 0.0, 0.2]
      }
    },
    "end_effector": {
      "position": [0.45, 0.1, 0.35],
      "quat": [0.95, 0.0, 0.2, 0.2]
    }
  }
}
```

### Acknowledgment event

```json
{
  "type": "ACK",
  "request_id": "req_005",
  "status": "ok"
}
```

### Error event

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

---

## 10. Data Models

## 10.1 Pose

### TypeScript

```ts
export interface Pose {
  position: [number, number, number];
  quat: [number, number, number, number]; // MuJoCo order: w, x, y, z
}
```

### Python

```py
from pydantic import BaseModel


class Pose(BaseModel):
    position: tuple[float, float, float]
    quat: tuple[float, float, float, float]  # MuJoCo order: w, x, y, z
```

---

## 10.2 Simulation State

### TypeScript

```ts
export interface SimulationState {
  session_id: string;
  sim_time: number;
  sequence: number;
  qpos: number[];
  qvel: number[];
  ctrl: number[];
  bodies: Record<string, Pose>;
  end_effector?: Pose;
}
```

### Python

```py
from pydantic import BaseModel


class SimulationState(BaseModel):
    session_id: str
    sim_time: float
    sequence: int
    qpos: list[float]
    qvel: list[float]
    ctrl: list[float]
    bodies: dict[str, Pose]
    end_effector: Pose | None = None
```

---

## 10.3 Simulation Command

### TypeScript

```ts
export type SimulationCommand =
  | { type: "START"; request_id: string }
  | { type: "PAUSE"; request_id: string }
  | { type: "STEP"; request_id: string; payload: { steps: number } }
  | { type: "RESET"; request_id: string; payload?: { qpos?: number[] } }
  | {
      type: "SET_ACTUATOR_CTRL";
      request_id: string;
      payload: {
        actuator: string;
        value: number;
      };
    }
  | {
      type: "SET_JOINT_TARGETS";
      request_id: string;
      payload: {
        targets: Record<string, number>;
      };
    };
```

### Python

```py
from typing import Any, Literal
from pydantic import BaseModel


class SimulationCommand(BaseModel):
    type: Literal[
        "START",
        "PAUSE",
        "STEP",
        "RESET",
        "SET_ACTUATOR_CTRL",
        "SET_JOINT_TARGETS",
    ]
    request_id: str
    payload: dict[str, Any] | None = None
```

---

## 11. Quaternion Convention

MuJoCo commonly exposes quaternions in this order:

```text
[w, x, y, z]
```

Three.js expects quaternions in this order:

```text
[x, y, z, w]
```

Therefore the frontend must reorder quaternions before applying them to Three.js objects.

```ts
function applyMujocoPoseToObject3D(object: THREE.Object3D, pose: Pose) {
  const [x, y, z] = pose.position;
  const [w, qx, qy, qz] = pose.quat;

  object.position.set(x, y, z);
  object.quaternion.set(qx, qy, qz, w);
}
```

---

## 12. Backend Internal Design

## 12.1 Session Manager

The `SessionManager` owns all active simulation sessions.

Responsibilities:

- Create sessions.
- Retrieve sessions by ID.
- Delete sessions.
- Enforce active session limits.
- Clean up expired sessions.
- Stop simulation tasks on deletion.

Example interface:

```py
class SessionManager:
    def create_session(self, model_id: str, initial_qpos: list[float] | None) -> str:
        ...

    def get_session(self, session_id: str) -> SimSession:
        ...

    def delete_session(self, session_id: str) -> None:
        ...
```

---

## 12.2 Simulation Session

Each `SimSession` owns one MuJoCo model/data pair.

```text
SimSession
  ├── session_id
  ├── model_id
  ├── mj_model
  ├── mj_data
  ├── running
  ├── sequence
  ├── command lock
  ├── connected websocket clients
  ├── timestep
  └── current control buffer
```

Responsibilities:

- Apply commands.
- Step MuJoCo.
- Encode state.
- Broadcast state.
- Reset simulation.
- Track running/paused state.

---

## 12.3 Controller Layer

The controller layer converts user intent into MuJoCo control inputs.

MVP control modes:

1. Direct actuator control.
2. Joint position target control.

Later control modes:

1. Velocity control.
2. Torque control.
3. Cartesian end-effector control.
4. Trajectory tracking.
5. Operational space control.

---

## 12.4 State Encoder

The `StateEncoder` converts raw MuJoCo state into frontend-safe DTOs.

Responsibilities:

- Read `qpos`.
- Read `qvel`.
- Read `ctrl`.
- Read named body positions.
- Read named body orientations.
- Read end-effector pose.
- Convert NumPy arrays to JSON-safe Python lists.
- Include `sequence` and `sim_time`.

---

## 13. Frontend Internal Design

## 13.1 Frontend State Stores

Suggested stores:

```text
simStore
  ├── sessionId
  ├── connectionStatus
  ├── isRunning
  ├── latestState
  ├── commandStatus
  └── errors

robotStore
  ├── selectedModelId
  ├── modelMetadata
  ├── visualBodies
  └── jointMetadata

uiStore
  ├── selectedJoint
  ├── selectedBody
  ├── cameraMode
  ├── activePanel
  └── telemetrySettings
```

---

## 13.2 Robot Rendering

The viewport should:

1. Load visual meshes from `metadata.json`.
2. Create a map of `body_name -> Object3D`.
3. Listen to the latest backend state.
4. Apply each body pose to its corresponding object.
5. Render axes, grid, end-effector marker, and optional trajectory path.

Example logic:

```ts
for (const [bodyName, pose] of Object.entries(state.bodies)) {
  const object = bodyObjectMap.get(bodyName);
  if (!object) continue;

  applyMujocoPoseToObject3D(object, pose);
}
```

---

## 13.3 Optional Interpolation

The frontend may interpolate between received state packets to reduce visual jitter.

MVP can skip interpolation and directly apply latest poses.

Later:

```text
Incoming state buffer
  -> keep last two STATE packets
  -> interpolate position linearly
  -> slerp quaternion
  -> render interpolated body pose
```

---

## 14. Recommended Repository Structure

```text
robot-arm-simulator/
  frontend/
    package.json
    vite.config.ts
    tsconfig.json
    src/
      app/
        App.tsx
        routes.tsx
      api/
        httpClient.ts
        simSocket.ts
      components/
        viewport/
          RobotViewport.tsx
          RobotScene.tsx
          RobotBody.tsx
          FrameAxes.tsx
          EndEffectorMarker.tsx
        controls/
          JointControlPanel.tsx
          SimulationControls.tsx
          ControllerModeSelector.tsx
        telemetry/
          JointTelemetryTable.tsx
          EndEffectorPanel.tsx
          TimeSeriesChart.tsx
        trajectory/
          TrajectoryTimeline.tsx
          TrajectoryRecorder.tsx
      state/
        simStore.ts
        robotStore.ts
        uiStore.ts
      types/
        simulation.ts
        robot.ts
        commands.ts
      utils/
        quaternion.ts
        math.ts

  backend/
    pyproject.toml
    app/
      main.py
      api/
        routes_models.py
        routes_sessions.py
        websocket_sim.py
      core/
        config.py
        errors.py
        logging.py
      simulation/
        mujoco_runtime.py
        sim_session.py
        session_manager.py
        state_encoder.py
      robotics/
        controllers.py
        kinematics.py
        ik_solver.py
        trajectory.py
      schemas/
        commands.py
        state.py
        robot.py
        session.py
      storage/
        model_store.py
        project_store.py
    tests/
      test_model_loading.py
      test_session_lifecycle.py
      test_state_encoder.py
      test_websocket_sim.py

  models/
    simple_6dof_arm/
      model.xml
      metadata.json
      meshes/
        base.glb
        link_1.glb
        link_2.glb
        link_3.glb
        link_4.glb
        link_5.glb
        link_6.glb

  docs/
    architecture.md
    api.md
    simulation-loop.md
    model-format.md
    testing.md

  docker/
    frontend.Dockerfile
    backend.Dockerfile
    nginx.conf

  docker-compose.yml
  README.md
```

---

## 15. MVP Scope

## 15.1 Included in MVP

The MVP should include:

- One robot arm model.
- Backend MJCF loading.
- Backend simulation session creation.
- WebSocket state stream.
- Start, pause, reset, and step commands.
- Joint sliders.
- Actuator command support.
- Frontend 3D rendering from backend body poses.
- Telemetry table.
- End-effector pose display.
- Basic error handling.

---

## 15.2 Excluded from MVP

Do not start with:

- Reinforcement learning.
- Multi-user collaboration.
- Cloud accounts.
- Advanced scene editor.
- URDF import.
- Photorealistic rendering.
- Complex gripper contact tasks.
- Full trajectory optimization.
- Production authentication.
- Binary state transport.

These can be added later after the simulation loop is stable.

---

## 16. Non-Functional Requirements

## 16.1 Performance

Target local development performance:

| Metric | Target |
|---|---:|
| Physics step rate | 500–1000 Hz for simple arm |
| WebSocket state rate | 30–60 Hz |
| Frontend render rate | 60 FPS |
| Command latency | <50 ms local |
| Session startup time | <2 seconds for simple model |

Performance rules:

- Do not stream every MuJoCo step.
- Do not send mesh data over WebSocket.
- Send only visible body poses.
- Use compact JSON first.
- Move to binary transport only if profiling proves JSON is a bottleneck.
- Keep physics on backend and rendering on frontend.

---

## 16.2 Reliability

The system must handle:

- Invalid model ID.
- Invalid MJCF.
- Invalid command type.
- Invalid joint name.
- Invalid actuator name.
- Out-of-range control value.
- WebSocket disconnect.
- Session deletion while socket is connected.
- Simulation reset during playback.
- NaN or unstable simulation state.

Reliability rules:

```text
Invalid user command -> structured ERROR response
Backend exception -> logged error + safe session shutdown if required
WebSocket disconnect -> remove client from session
Session timeout -> stop simulation and release resources
```

---

## 16.3 Security

Minimum MVP security requirements:

- Restrict model loading to a known models directory.
- Do not execute user-uploaded scripts.
- Validate model IDs and paths.
- Prevent path traversal.
- Limit maximum number of active sessions.
- Limit WebSocket message size.
- Clamp actuator commands.
- Configure CORS explicitly.
- Add authentication before public deployment.

---

## 16.4 Observability

Backend should log:

- App startup.
- Model list loaded.
- Session created.
- Session deleted.
- WebSocket connected.
- WebSocket disconnected.
- Simulation started.
- Simulation paused.
- Simulation reset.
- Invalid command.
- Simulation error.
- State stream rate.
- Physics step timing.

Recommended endpoints:

```http
GET /health
GET /metrics
```

Suggested metrics:

- Active sessions.
- Connected WebSocket clients.
- Average physics step duration.
- State messages per second.
- Command messages per second.
- Error count.
- Session memory estimate.

---

## 16.5 Maintainability

Rules:

- Keep simulation code separate from API code.
- Keep rendering code separate from UI control code.
- Use shared schemas where practical.
- Keep message contracts versioned.
- Add tests before adding advanced robotics features.
- Keep robot metadata explicit.
- Avoid hardcoding robot-specific behavior in generic simulator code.

---

## 17. Testing Strategy

## 17.1 Backend Unit Tests

Test:

- MJCF model loading.
- Model metadata parsing.
- Session creation.
- Session deletion.
- Command parsing.
- Joint limit clamping.
- Actuator lookup.
- State encoding.
- Reset behavior.
- NaN detection.

---

## 17.2 Backend Integration Tests

Test the full session flow:

```text
Create session
  -> Connect WebSocket
  -> Receive initial STATE
  -> Send START
  -> Receive increasing sim_time
  -> Send SET_ACTUATOR_CTRL
  -> Verify qpos changes
  -> Send RESET
  -> Verify qpos returns near initial state
  -> Delete session
```

---

## 17.3 Frontend Tests

Test:

- App renders.
- Model list loads.
- Session is created.
- WebSocket connects.
- State store updates.
- Joint sliders emit correct command messages.
- Telemetry table updates.
- Viewport receives body poses.
- Quaternion conversion works.

---

## 17.4 Simulation Validation Tests

For every robot model:

- Expected joint count.
- Expected actuator count.
- Expected named bodies.
- Joint limits match metadata.
- Initial state is stable.
- No NaN after 10,000 simulation steps.
- End-effector body exists.
- Reset is deterministic.

---

## 18. Deployment Architecture

## 18.1 Local Development

```text
React dev server:
  http://localhost:5173

FastAPI backend:
  http://localhost:8000

WebSocket:
  ws://localhost:8000/ws/sim/{session_id}
```

---

## 18.2 Production Deployment

```text
Browser
  ↓ HTTPS / WSS
Nginx or reverse proxy
  ├── Serves React static build
  └── Proxies /api and /ws
        ↓
FastAPI backend
  ↓
MuJoCo runtime
  ↓
Robot model files
```

---

## 18.3 Docker Compose Layout

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./models:/app/models

  frontend:
    build:
      context: .
      dockerfile: docker/frontend.Dockerfile

  nginx:
    image: nginx:stable
    ports:
      - "80:80"
    depends_on:
      - frontend
      - backend
```

---

## 19. Future Extensions

After the MVP is stable, add:

1. **Inverse kinematics**
   - Backend endpoint: `POST /api/ik/solve`
   - Solver: damped least squares
   - Constraints: joint limits, target tolerance

2. **Trajectory system**
   - Record qpos over time
   - Save/load trajectories
   - Timeline scrubber
   - Playback speed control

3. **Scene editor**
   - Add boxes, cylinders, spheres, tables, and targets
   - Edit object poses
   - Enable/disable collision

4. **Camera simulation**
   - Backend-rendered RGB/depth/segmentation camera streams
   - Useful for computer vision and ML workflows

5. **Motion planning**
   - Collision-aware planning
   - Waypoint execution
   - Path smoothing

6. **Dataset generation**
   - Run scripted simulations
   - Export robot state, camera frames, labels, and trajectories

7. **Authentication and persistence**
   - User projects
   - Saved robot scenes
   - Saved trajectories

---

## 20. First Implementation Milestone

The first complete milestone should be:

```text
A local React app connects to a FastAPI backend, creates a MuJoCo simulation
session, starts and pauses the simulation, controls a simple robot arm using
joint sliders, receives live body poses over WebSocket, and renders the robot
in a Three.js viewport.
```

Acceptance criteria:

- Backend loads one MJCF arm.
- Backend runs 1000 simulation steps without NaN.
- Frontend creates a session.
- WebSocket receives live `STATE` messages.
- Robot body poses are rendered in the browser.
- Moving a slider changes the simulated and rendered robot.
- Reset returns the robot to its initial pose.

---

## 21. Summary

This architecture uses a clean split:

```text
Backend:
  MuJoCo physics, simulation sessions, control, state, future IK/planning

Frontend:
  React UI, Three.js rendering, telemetry, interaction, visualization
```

The main integration contract is:

```text
MuJoCo body name
  -> backend body pose stream
  -> frontend visual body mesh
```

The first priority is not advanced robotics algorithms. The first priority is a stable, observable, testable simulation loop from backend physics to frontend rendering.
