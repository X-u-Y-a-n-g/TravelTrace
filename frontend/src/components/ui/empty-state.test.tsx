import { render, screen } from "@testing-library/react";
import { Camera } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the title, description and action", () => {
    render(
      <EmptyState
        icon={Camera}
        title="No photos yet"
        description="Import your first batch."
        action={<button type="button">Import</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No photos yet" })).toBeInTheDocument();
    expect(screen.getByText("Import your first batch.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
  });

  it("works without a description or action", () => {
    render(<EmptyState icon={Camera} title="Nothing here" />);
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
