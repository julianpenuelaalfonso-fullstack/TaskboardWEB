import { afterEach, expect, it, vi } from "vitest";
import { getTheme, setTheme } from "./theme";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

it("setTheme('dark') pone data-theme y guarda el valor", () => {
  setTheme("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("taskboard-theme")).toBe("dark");
  expect(getTheme()).toBe("dark");
});

it("system quita el atributo", () => {
  setTheme("dark");
  setTheme("system");
  expect(document.documentElement).not.toHaveAttribute("data-theme");
});

it("si localStorage lanza, getTheme devuelve system y setTheme no rompe", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(getTheme()).toBe("system");
  expect(() => setTheme("light")).not.toThrow();
  expect(document.documentElement.dataset.theme).toBe("light");
});
