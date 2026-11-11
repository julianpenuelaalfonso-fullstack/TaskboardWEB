import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "./Dialog";

it("se nombra por su título y Esc llama a onClose una sola vez", () => {
  const onClose = vi.fn();
  const { rerender } = render(<Dialog open onClose={onClose} title="Eliminar tablero" />);
  const dialog = screen.getByRole("dialog", { name: "Eliminar tablero" });
  fireEvent(dialog, new Event("close"));
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(<Dialog open={false} onClose={onClose} title="Eliminar tablero" />);
  expect(onClose).toHaveBeenCalledTimes(1);
});
