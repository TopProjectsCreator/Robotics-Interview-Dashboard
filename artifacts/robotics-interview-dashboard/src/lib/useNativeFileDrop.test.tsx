import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNativeFileDrop } from "./useNativeFileDrop";

function transfer(files: File[], types = ["Files"]) {
  return {
    files,
    types,
    dropEffect: "none",
  };
}

function DropTarget({ onFiles, disabled = false }: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const { fileDropProps, isDraggingFiles } = useNativeFileDrop(onFiles, { disabled });
  return <div {...fileDropProps} data-testid="target" className={isDraggingFiles ? "active" : ""}>
    <span>Drop files</span>
  </div>;
}

describe("useNativeFileDrop", () => {
  it("passes a multi-file drop to the existing selection callback and clears active feedback", () => {
    const onFiles = vi.fn();
    render(<DropTarget onFiles={onFiles} />);
    const target = screen.getByTestId("target");
    const files = [
      new File(["one"], "one.csv", { type: "text/csv" }),
      new File(["two"], "two.csv", { type: "text/csv" }),
    ];
    const dataTransfer = transfer(files);

    fireEvent.dragEnter(target, { dataTransfer });
    expect(target).toHaveClass("active");
    fireEvent.dragOver(target, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("copy");
    expect(fireEvent.drop(target, { dataTransfer })).toBe(false);

    expect(onFiles).toHaveBeenCalledWith(files);
    expect(target).not.toHaveClass("active");
  });

  it("ignores internal app drags and does not call the file callback", () => {
    const onFiles = vi.fn();
    render(<DropTarget onFiles={onFiles} />);
    const target = screen.getByTestId("target");
    const dataTransfer = transfer([], ["text/plain"]);

    fireEvent.dragEnter(target, { dataTransfer });
    expect(fireEvent.drop(target, { dataTransfer })).toBe(true);
    expect(target).not.toHaveClass("active");
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("cancels browser file navigation but does not select files while disabled", () => {
    const onFiles = vi.fn();
    render(<DropTarget onFiles={onFiles} disabled />);
    const target = screen.getByTestId("target");
    const dataTransfer = transfer([new File(["image"], "photo.png", { type: "image/png" })]);

    expect(fireEvent.drop(target, { dataTransfer })).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
    expect(target).not.toHaveClass("active");
  });

  it("does not clear active feedback when the pointer moves between nested children", () => {
    const onFiles = vi.fn();
    function NestedTarget() {
      const { fileDropProps, isDraggingFiles } = useNativeFileDrop(onFiles);
      return <div {...fileDropProps} data-testid="target" className={isDraggingFiles ? "active" : ""}>
        <span data-testid="child">Drop files</span>
      </div>;
    }
    render(<NestedTarget />);
    const target = screen.getByTestId("target");
    const child = screen.getByTestId("child");
    const dataTransfer = transfer([new File(["one"], "one.txt", { type: "text/plain" })]);

    fireEvent.dragEnter(target, { dataTransfer });
    const dragLeave = createEvent.dragLeave(target, { dataTransfer });
    Object.defineProperty(dragLeave, "relatedTarget", { value: child });
    fireEvent(target, dragLeave);
    expect(target).toHaveClass("active");
  });
});
