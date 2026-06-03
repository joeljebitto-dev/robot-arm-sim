// frontend/src/App.test.tsx

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the simulator title", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /robot arm simulator/i,
      }),
    ).toBeInTheDocument();
  });
});
