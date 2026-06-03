// frontend/src/api/healthApi.ts

export interface HealthResponse {
  status: string;
  environment: string;
}

export async function getBackendHealth(): Promise<HealthResponse> {
  const response = await fetch("/health", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Backend health check failed: ${response.status}`);
  }

  const data = (await response.json()) as HealthResponse;

  if (typeof data.status !== "string") {
    throw new Error("Invalid backend health response: missing status");
  }

  return data;
}
