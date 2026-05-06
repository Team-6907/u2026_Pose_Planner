import { degreesToRadians } from "../utils/math.js";

export function fieldToPixel(state, elements, fx, fy) {
  const m = state.fieldMetrics;
  const w = elements.canvas.width;
  const h = elements.canvas.height;
  // Wall-blue after rotating the source field layout 180 degrees:
  // X=0 is at the blue wall on the left, and +Y points down the canvas.
  return {
    x: (w - m.right) + fx * m.pxPerMeterX,
    y: (h - m.bottom) + fy * m.pxPerMeterY
  };
}

export function pixelToField(state, elements, px, py) {
  const m = state.fieldMetrics;
  const w = elements.canvas.width;
  const h = elements.canvas.height;
  return {
    x: (px - w + m.right) / m.pxPerMeterX,
    y: (py - h + m.bottom) / m.pxPerMeterY
  };
}

export function getFieldPixelBounds(state, elements) {
  const m = state.fieldMetrics;
  const w = elements.canvas.width;
  const h = elements.canvas.height;
  return {
    left: w - m.right,
    right: w - m.left,
    top: h - m.bottom,
    bottom: h - m.top
  };
}

export function getHandlePixel(state, elements, pose) {
  const r = degreesToRadians(pose.thetaDegrees);
  const d = Math.max(state.robot.lengthMeters / 2 + 0.4, 0.6);
  return fieldToPixel(state, elements, pose.x + Math.cos(r) * d, pose.y + Math.sin(r) * d);
}

export function getPointerPixel(state, elements, e) {
  const rect = elements.canvas.getBoundingClientRect();
  const sx = elements.canvas.width / rect.width;
  const sy = elements.canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * sx - state.pan.x,
    y: (e.clientY - rect.top) * sy - state.pan.y
  };
}
