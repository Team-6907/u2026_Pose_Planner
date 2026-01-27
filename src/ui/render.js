import { colorWithAlpha } from "../utils/color.js";
import { degreesToRadians, round } from "../utils/math.js";
import { fieldToPixel, getHandlePixel } from "../field/coords.js";
import {
  ensureSelectionVisible,
  getSelectedGroupName,
  getSelectedPose,
  getTotalPoseCount,
  getVisiblePoseEntries,
  isSelected
} from "../state/poseState.js";

export function render(app) {
  const { state, elements, ctx } = app;
  if (!state.image || !state.fieldMetrics) return;

  const canvas = elements.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(state.pan.x, state.pan.y);

  // Draw flipped field image (for wall-blue coordinates)
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  drawGrid(app);
  getVisiblePoseEntries(state).forEach((entry) =>
    drawPose(app, entry.pose, entry.group, isSelected(state, entry.groupIndex, entry.poseIndex))
  );

  ctx.restore();
  renderPoseList(app);
  renderGroupFilters(app);
}

export function renderPoseList(app) {
  const { state, elements } = app;
  elements.poseList.innerHTML = "";
  const entries = getVisiblePoseEntries(state);
  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.classList.toggle("active", isSelected(state, entry.groupIndex, entry.poseIndex));

    const name = document.createElement("span");
    name.className = "pose-name";
    name.textContent = entry.pose.name;

    const groupTag = document.createElement("span");
    groupTag.className = "pose-tag";
    groupTag.textContent = entry.group.name;
    if (entry.group.color) {
      groupTag.style.border = `1px solid ${colorWithAlpha(entry.group.color, 0.6)}`;
    }

    const coords = document.createElement("span");
    coords.className = "pose-coords";
    coords.textContent = `(${round(entry.pose.x, 2)}, ${round(entry.pose.y, 2)})`;

    li.appendChild(name);
    li.appendChild(groupTag);
    li.appendChild(coords);

    li.addEventListener("click", () => {
      app.selectPose(entry.groupIndex, entry.poseIndex);
      render(app);
    });
    elements.poseList.appendChild(li);
  });

  if (elements.poseCount) {
    const total = getTotalPoseCount(state);
    const visible = entries.length;
    elements.poseCount.textContent =
      state.groupFilter.size > 0 ? `${visible}/${total}` : `${total}`;
  }

  const has = state.selectedGroupIndex >= 0 && state.selectedPoseIndex >= 0;
  elements.deletePose.disabled = !has;
  elements.poseName.disabled = !has;
  elements.poseGroup.disabled = !has || state.groups.length === 0;
  elements.poseX.disabled = !has;
  elements.poseY.disabled = !has;
  elements.poseTheta.disabled = !has;
}

export function renderGroupFilters(app) {
  const { state, elements } = app;
  if (!elements.groupFilters) return;
  elements.groupFilters.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "group-chip" + (state.groupFilter.size === 0 ? " active" : "");
  allChip.textContent = "All";
  allChip.addEventListener("click", () => {
    state.groupFilter.clear();
    ensureSelectionVisible(state);
    render(app);
  });
  elements.groupFilters.appendChild(allChip);

  state.groups.forEach((group) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className =
      "group-chip" + (state.groupFilter.has(group.name) ? " active" : "");

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.backgroundColor = group.color || "#94a3b8";

    const label = document.createElement("span");
    label.textContent = group.name;

    chip.appendChild(dot);
    chip.appendChild(label);

    chip.addEventListener("click", () => {
      if (state.groupFilter.size === 0) {
        state.groupFilter.add(group.name);
      } else if (state.groupFilter.has(group.name)) {
        state.groupFilter.delete(group.name);
      } else {
        state.groupFilter.add(group.name);
      }
      ensureSelectionVisible(state);
      render(app);
    });
    chip.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      app.openGroupContextMenu?.(group.name, event.clientX, event.clientY);
    });

    elements.groupFilters.appendChild(chip);
  });
}

export function renderGroupSelect(app) {
  const { state, elements } = app;
  if (!elements.poseGroup) return;
  elements.poseGroup.innerHTML = "";

  state.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.name;
    option.textContent = group.name;
    elements.poseGroup.appendChild(option);
  });

  const selected = getSelectedGroupName(state);
  if (selected) {
    elements.poseGroup.value = selected;
  }
}

export function updateInputsFromSelection(app) {
  const { state, elements } = app;
  const p = getSelectedPose(state);
  const m = state.fieldMetrics;
  renderGroupSelect(app);

  elements.poseName.value = p?.name ?? "";

  const has = !!p;
  if (p) {
    elements.poseX.value = p.x;
    elements.poseY.value = p.y;
    elements.poseTheta.value = p.thetaDegrees;
    elements.poseXInput.value = round(p.x, 2);
    elements.poseYInput.value = round(p.y, 2);
    elements.poseThetaInput.value = round(p.thetaDegrees, 0);
  } else {
    elements.poseX.value = 0;
    elements.poseY.value = 0;
    elements.poseTheta.value = 0;
    elements.poseXInput.value = "0.00";
    elements.poseYInput.value = "0.00";
    elements.poseThetaInput.value = "0";
  }

  elements.poseXInput.disabled = !has;
  elements.poseYInput.disabled = !has;
  elements.poseThetaInput.disabled = !has;

  if (m) {
    elements.poseX.max = m.fieldLengthMeters;
    elements.poseY.max = m.fieldWidthMeters;
    elements.poseXInput.max = m.fieldLengthMeters;
    elements.poseYInput.max = m.fieldWidthMeters;
  }
}

function drawGrid(app) {
  const { state, ctx } = app;
  const m = state.fieldMetrics;
  ctx.strokeStyle = "rgba(16, 185, 129, 0.08)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= m.fieldLengthMeters; x++) {
    const px = fieldToPixel(state, app.elements, x, 0);
    ctx.beginPath();
    ctx.moveTo(px.x, m.top);
    ctx.lineTo(px.x, m.bottom);
    ctx.stroke();
  }
  for (let y = 0; y <= m.fieldWidthMeters; y++) {
    const px = fieldToPixel(state, app.elements, 0, y);
    ctx.beginPath();
    ctx.moveTo(m.left, px.y);
    ctx.lineTo(m.right, px.y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(16, 185, 129, 0.2)";
  ctx.lineWidth = 2;
  const cx = fieldToPixel(state, app.elements, m.fieldLengthMeters / 2, 0);
  ctx.beginPath();
  ctx.moveTo(cx.x, m.top);
  ctx.lineTo(cx.x, m.bottom);
  ctx.stroke();
}

function drawPose(app, pose, group, isSelectedPose) {
  const { state, ctx } = app;
  const { x, y } = fieldToPixel(state, app.elements, pose.x, pose.y);
  const theta = degreesToRadians(pose.thetaDegrees);
  const m = state.fieldMetrics;
  const lPx = state.robot.lengthMeters * m.pxPerMeterX;
  const wPx = state.robot.widthMeters * m.pxPerMeterY;

  const groupColor = group?.color || "#94a3b8";
  const fill = isSelectedPose ? "rgba(16, 185, 129, 0.6)" : colorWithAlpha(groupColor, 0.45);
  const stroke = isSelectedPose ? "#10b981" : groupColor;
  const arrow = isSelectedPose ? "#f59e0b" : groupColor;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-theta);

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  roundRect(ctx, -lPx / 2, -wPx / 2, lPx, wPx, 6);
  ctx.fill();
  ctx.stroke();

  // Long edge arrow - vertical, from bottom edge pointing toward center
  ctx.fillStyle = arrow;
  ctx.beginPath();
  ctx.moveTo(0, wPx / 2);
  ctx.lineTo(-10, wPx / 2 - 18);
  ctx.lineTo(10, wPx / 2 - 18);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = arrow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, wPx / 2);
  ctx.lineTo(0, wPx / 2 - 40);
  ctx.stroke();

  // Short edge arrow - horizontal, from center pointing toward right edge
  ctx.fillStyle = arrow;
  ctx.beginPath();
  ctx.moveTo(lPx / 2, 0);
  ctx.lineTo(lPx / 2 - 18, -10);
  ctx.lineTo(lPx / 2 - 18, 10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = arrow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(lPx / 2 - 18, 0);
  ctx.stroke();

  ctx.restore();

  ctx.font = "bold 14px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(pose.name, x + lPx / 2 + 10, y - 4);
  ctx.fillStyle = "#fff";
  ctx.fillText(pose.name, x + lPx / 2 + 8, y - 6);

  if (isSelectedPose) {
    const h = getHandlePixel(state, app.elements, pose);
    ctx.beginPath();
    ctx.arc(h.x, h.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(h.x, h.y);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
