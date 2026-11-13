import { describe, expect, it } from "vitest";
import * as H from "./history";

describe("history", () => {
  it("commit / undo / redo", () => {
    let h = H.createHistory(1);
    h = H.commit(h, 2);
    h = H.commit(h, 3);
    expect(h.present).toBe(3);
    h = H.undo(h);
    expect(h.present).toBe(2);
    h = H.undo(h);
    expect(h.present).toBe(1);
    h = H.undo(h);
    expect(h.present).toBe(1);
    h = H.redo(h);
    expect(h.present).toBe(2);
  });

  it("un commit nuevo descarta el futuro", () => {
    let h = H.commit(H.createHistory("a"), "b");
    h = H.undo(h);
    h = H.commit(h, "c");
    expect(h.future).toHaveLength(0);
    expect(H.redo(h).present).toBe("c");
  });

  it("un gesto continuo genera una sola entrada", () => {
    let h = H.createHistory(0);
    h = H.beginGesture(h);
    for (let i = 1; i <= 50; i++) h = H.commit(h, i);
    h = H.endGesture(h);
    expect(h.past).toEqual([0]);
    expect(H.undo(h).present).toBe(0);
  });

  it("un gesto sin cambios no genera entrada", () => {
    const h = H.endGesture(H.beginGesture(H.createHistory(5)));
    expect(h.past).toHaveLength(0);
  });

  it("respeta el límite de historial", () => {
    let h = H.createHistory(0);
    for (let i = 1; i <= H.HISTORY_LIMIT + 20; i++) h = H.commit(h, i);
    expect(h.past.length).toBe(H.HISTORY_LIMIT);
  });
});
