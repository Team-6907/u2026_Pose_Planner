import { degreesToRadians } from "../utils/math.js";

export function fieldToPixel(state, elements, fx, fy) {
  const m = state.fieldMetrics;
  const w = elements.canvas.width;
  // Wall-blue: X=0 at blue alliance (left side after image flip)
  return {
    x: (w - m.right) + fx * m.pxPerMeterX,
    y: m.bottom - fy * m.pxPerMeterY
  };
}

export function pixelToField(state, elements, px, py) {
  const m = state.fieldMetrics;
  const w = elements.canvas.width;
  return {
    x: (px - w + m.right) / m.pxPerMeterX,
    y: (m.bottom - py) / m.pxPerMeterY
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
