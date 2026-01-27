import { buildPosePayload, parsePosePayload, saveToLocalStorage, clearLocalStorage } from "../io/poseIO.js";
import {
  createDefaultName,
  ensureGroup,
  getSelectedPose,
  getTargetGroupForNewPose,
  pickGroupColor,
  selectFirstPose,
  selectPose,
  syncGroupFilter
} from "../state/poseState.js";
import { clamp, distance, radiansToDegrees, round } from "../utils/math.js";
import { fieldToPixel, getHandlePixel, getPointerPixel, pixelToField } from "../field/coords.js";
import { render, renderPoseList, updateInputsFromSelection } from "./render.js";

export function wireEvents(app) {
  const { elements } = app;

  elements.addPose.addEventListener("click", () => addPoseAtCenter(app));
  elements.deletePose.addEventListener("click", () => deleteSelectedPose(app));
  elements.addGroup?.addEventListener("click", () => addGroup(app));
  elements.poseName.addEventListener("input", () => onNameChange(app));
  elements.poseGroup?.addEventListener("change", () => onGroupChange(app));
  elements.poseX.addEventListener("input", () => updatePoseFromSliders(app));
  elements.poseY.addEventListener("input", () => updatePoseFromSliders(app));
  elements.poseTheta.addEventListener("input", () => updatePoseFromSliders(app));
  elements.poseXInput.addEventListener("change", () => updatePoseFromNumberInputs(app));
  elements.poseYInput.addEventListener("change", () => updatePoseFromNumberInputs(app));
  elements.poseThetaInput.addEventListener("change", () => updatePoseFromNumberInputs(app));
  elements.pasteJson.addEventListener("click", () => handlePaste(app));
  elements.uploadJson.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", (e) => handleFileUpload(app, e));
  elements.copyJson.addEventListener("click", () => handleCopy(app));
  elements.clearAll.addEventListener("click", () => handleClearAll(app));
  elements.resetView?.addEventListener("click", () => resetView(app));

  elements.configBtn?.addEventListener("click", () => openConfigModal(app));
  elements.configClose?.addEventListener("click", () => closeConfigModal(app));
  elements.configSave?.addEventListener("click", () => saveConfig(app));
  elements.configModal
    ?.querySelector(".modal-backdrop")
    ?.addEventListener("click", () => closeConfigModal(app));

  elements.canvas.addEventListener("pointerdown", (e) => onPointerDown(app, e));
  elements.canvas.addEventListener("pointermove", (e) => onPointerMove(app, e));
  elements.canvas.addEventListener("pointerup", () => onPointerUp(app));
  elements.canvas.addEventListener("pointerleave", () => onPointerUp(app));
  elements.canvas.addEventListener("dblclick", (e) => onDoubleClick(app, e));
  elements.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => onKeyDown(app, e));

  wireGroupContextMenu(app);
}

function addPoseAtCenter(app) {
  const { state } = app;
  saveUndoState(state);
  const m = state.fieldMetrics;
  const target = getTargetGroupForNewPose(state);
  target.group.poses.push({
    name: createDefaultName(state),
    x: m.fieldLengthMeters / 2,
    y: m.fieldWidthMeters / 2,
    thetaDegrees: 0
  });
  app.selectPose(target.groupIndex, target.group.poses.length - 1);
  saveToLocalStorage(state);
  render(app);
}

function addPoseAt(app, fx, fy) {
  const { state } = app;
  saveUndoState(state);
  const m = state.fieldMetrics;
  const target = getTargetGroupForNewPose(state);
  target.group.poses.push({
    name: createDefaultName(state),
    x: clamp(fx, 0, m.fieldLengthMeters),
    y: clamp(fy, 0, m.fieldWidthMeters),
    thetaDegrees: 0
  });
  app.selectPose(target.groupIndex, target.group.poses.length - 1);
  saveToLocalStorage(state);
  render(app);
}

function deleteSelectedPose(app) {
  const { state } = app;
  if (state.selectedGroupIndex < 0 || state.selectedPoseIndex < 0) return;
  saveUndoState(state);
  const group = state.groups[state.selectedGroupIndex];
  if (!group) return;
  group.poses.splice(state.selectedPoseIndex, 1);
  if (group.poses.length === 0) {
    app.selectPose(-1, -1);
  } else {
    app.selectPose(state.selectedGroupIndex, Math.max(0, state.selectedPoseIndex - 1));
  }
  saveToLocalStorage(state);
  render(app);
}

function onNameChange(app) {
  const pose = getSelectedPose(app.state);
  if (pose) {
    pose.name = app.elements.poseName.value.trim() || pose.name;
    saveToLocalStorage(app.state);
    renderPoseList(app);
  }
}

function addGroup(app) {
  const input = window.prompt("Group name");
  if (!input) return;
  const name = input.trim();
  if (!name) return;
  if (app.state.groups.some((group) => group.name === name)) {
    app.setStatus("Group already exists.", true);
    return;
  }
  saveUndoState(app.state);
  app.state.groups.push({
    name,
    color: pickGroupColor(app.state.groups.length),
    poses: []
  });
  saveToLocalStorage(app.state);
  render(app);
}

function wireGroupContextMenu(app) {
  const { groupContextMenu } = app.elements;
  if (!groupContextMenu) return;

  app.groupContextTarget = null;
  app.openGroupContextMenu = (groupName, x, y) => {
    app.groupContextTarget = groupName;
    groupContextMenu.style.left = `${x}px`;
    groupContextMenu.style.top = `${y}px`;
    groupContextMenu.classList.remove("hidden");
  };
  app.closeGroupContextMenu = () => {
    app.groupContextTarget = null;
    groupContextMenu.classList.add("hidden");
  };

  groupContextMenu.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (!action || !app.groupContextTarget) return;
    if (action === "rename") {
      renameGroup(app, app.groupContextTarget);
    } else if (action === "delete") {
      deleteGroup(app, app.groupContextTarget);
    }
    app.closeGroupContextMenu();
  });

  document.addEventListener("click", (event) => {
    if (!groupContextMenu.contains(event.target)) {
      app.closeGroupContextMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !groupContextMenu.classList.contains("hidden")) {
      app.closeGroupContextMenu();
    }
  });
}

function renameGroup(app, oldName) {
  const group = app.state.groups.find((g) => g.name === oldName);
  if (!group) return;
  const input = window.prompt("Rename group", oldName);
  if (!input) return;
  const name = input.trim();
  if (!name || name === oldName) return;
  if (app.state.groups.some((g) => g.name === name)) {
    app.setStatus("Group already exists.", true);
    return;
  }
  saveUndoState(app.state);
  group.name = name;
  if (app.state.groupFilter.has(oldName)) {
    app.state.groupFilter.delete(oldName);
    app.state.groupFilter.add(name);
  }
  saveToLocalStorage(app.state);
  updateInputsFromSelection(app);
  render(app);
}

function deleteGroup(app, name) {
  const index = app.state.groups.findIndex((g) => g.name === name);
  if (index < 0) return;
  const group = app.state.groups[index];
  const shouldDelete = window.confirm(
    `Delete group \"${group.name}\" and its ${group.poses.length} poses?`
  );
  if (!shouldDelete) return;

  saveUndoState(app.state);
  app.state.groups.splice(index, 1);
  app.state.groupFilter.delete(name);

  if (app.state.selectedGroupIndex === index) {
    selectFirstPose(app.state);
  } else if (app.state.selectedGroupIndex > index) {
    selectPose(app.state, app.state.selectedGroupIndex - 1, app.state.selectedPoseIndex);
  }
  saveToLocalStorage(app.state);
  updateInputsFromSelection(app);
  render(app);
}

function onGroupChange(app) {
  const pose = getSelectedPose(app.state);
  if (!pose) return;
  const targetName = app.elements.poseGroup.value;
  moveSelectedPoseToGroup(app, targetName);
  render(app);
}

function moveSelectedPoseToGroup(app, targetName) {
  const { state } = app;
  const currentGroup = state.groups[state.selectedGroupIndex];
  if (!currentGroup) return;
  const target = ensureGroup(state, targetName);
  if (currentGroup.name === target.group.name) return;

  saveUndoState(state);
  const pose = currentGroup.poses.splice(state.selectedPoseIndex, 1)[0];
  target.group.poses.push(pose);
  app.selectPose(target.groupIndex, target.group.poses.length - 1);
  saveToLocalStorage(state);
}

async function handleCopy(app) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(buildPosePayload(app.state), null, 2));
    app.setStatus("Copied to clipboard");
  } catch {
    app.setStatus("Copy failed", true);
  }
}

async function handlePaste(app) {
  try {
    const text = await navigator.clipboard.readText();
    const data = JSON.parse(text);
    const groups = parsePosePayload(data);
    if (groups.length === 0) {
      app.setStatus("Invalid JSON format", true);
      return;
    }
    saveUndoState(app.state);
    app.state.groups = groups;
    syncGroupFilter(app.state);
    selectFirstPose(app.state);
    saveToLocalStorage(app.state);
    render(app);
    app.setStatus(`Imported ${groups.reduce((sum, g) => sum + g.poses.length, 0)} poses`);
  } catch (error) {
    app.setStatus("Paste failed: " + error.message, true);
  }
}

function handleFileUpload(app, event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const groups = parsePosePayload(data);
      if (groups.length === 0) {
        app.setStatus("Invalid JSON format", true);
        return;
      }
      saveUndoState(app.state);
      app.state.groups = groups;
      syncGroupFilter(app.state);
      selectFirstPose(app.state);
      saveToLocalStorage(app.state);
      render(app);
      app.setStatus(`Imported ${groups.reduce((sum, g) => sum + g.poses.length, 0)} poses from ${file.name}`);
    } catch (error) {
      app.setStatus("File import failed: " + error.message, true);
    }
  };
  reader.onerror = () => {
    app.setStatus("Failed to read file", true);
  };
  reader.readAsText(file);
  event.target.value = "";
}

function handleClearAll(app) {
  if (!confirm("Clear all poses and groups? This will also clear browser storage.")) {
    return;
  }
  saveUndoState(app.state);
  app.state.groups = [];
  app.state.selectedGroupIndex = -1;
  app.state.selectedPoseIndex = -1;
  syncGroupFilter(app.state);
  clearLocalStorage();
  render(app);
  app.setStatus("All poses cleared");
}

function resetView(app) {
  app.state.pan = { x: 0, y: 0 };
  render(app);
}

function openConfigModal(app) {
  app.elements.robotLength.value = Math.round(app.state.robot.lengthMeters * 1000);
  app.elements.robotWidth.value = Math.round(app.state.robot.widthMeters * 1000);
  app.elements.configModal.classList.remove("hidden");
}

function closeConfigModal(app) {
  app.elements.configModal.classList.add("hidden");
}

function saveConfig(app) {
  const lengthMm = parseInt(app.elements.robotLength.value) || 618;
  const widthMm = parseInt(app.elements.robotWidth.value) || 766;
  app.state.robot.lengthMeters = lengthMm / 1000;
  app.state.robot.widthMeters = widthMm / 1000;
  closeConfigModal(app);
  render(app);
  app.setStatus(`Robot size: ${lengthMm}mm × ${widthMm}mm`);
}

function updatePoseFromSliders(app) {
  const p = getSelectedPose(app.state);
  if (!p) return;
  const m = app.state.fieldMetrics;
  p.x = clamp(parseFloat(app.elements.poseX.value) || 0, 0, m.fieldLengthMeters);
  p.y = clamp(parseFloat(app.elements.poseY.value) || 0, 0, m.fieldWidthMeters);
  p.thetaDegrees = parseFloat(app.elements.poseTheta.value) || 0;

  app.elements.poseXInput.value = round(p.x, 2);
  app.elements.poseYInput.value = round(p.y, 2);
  app.elements.poseThetaInput.value = round(p.thetaDegrees, 0);

  saveToLocalStorage(app.state);
  render(app);
}

function updatePoseFromNumberInputs(app) {
  const p = getSelectedPose(app.state);
  if (!p) return;
  const m = app.state.fieldMetrics;
  p.x = clamp(parseFloat(app.elements.poseXInput.value) || 0, 0, m.fieldLengthMeters);
  p.y = clamp(parseFloat(app.elements.poseYInput.value) || 0, 0, m.fieldWidthMeters);
  p.thetaDegrees = parseFloat(app.elements.poseThetaInput.value) || 0;

  app.elements.poseX.value = p.x;
  app.elements.poseY.value = p.y;
  app.elements.poseTheta.value = p.thetaDegrees;

  app.elements.poseXInput.value = round(p.x, 2);
  app.elements.poseYInput.value = round(p.y, 2);
  app.elements.poseThetaInput.value = round(p.thetaDegrees, 0);

  saveToLocalStorage(app.state);
  render(app);
}

function onPointerDown(app, e) {
  if (!app.state.fieldMetrics) return;
  const ptr = getPointerPixel(app.state, app.elements, e);

  if (e.button === 1 || e.button === 2) {
    app.state.isPanning = true;
    app.state.panStart = { x: e.clientX - app.state.pan.x, y: e.clientY - app.state.pan.y };
    app.elements.canvas.style.cursor = "grabbing";
    return;
  }

  const hit = findPoseNear(app, ptr);
  if (hit) {
    app.selectPose(hit.groupIndex, hit.poseIndex);
    const h = getHandlePixel(app.state, app.elements, hit.pose);
    if (distance(ptr, h) <= 15) {
      app.state.drag = { mode: "rotate" };
    } else {
      saveUndoState(app.state);
      app.state.drag = { mode: "move" };
    }
  } else {
    app.selectPose(-1, -1);
  }
  render(app);
}

function onPointerMove(app, e) {
  const ptr = getPointerPixel(app.state, app.elements, e);
  const f = pixelToField(app.state, app.elements, ptr.x, ptr.y);
  const m = app.state.fieldMetrics;

  if (app.elements.coordinates) {
    if (f.x >= 0 && f.x <= m.fieldLengthMeters && f.y >= 0 && f.y <= m.fieldWidthMeters) {
      app.elements.coordinates.textContent = `X: ${round(f.x, 2)}m  Y: ${round(f.y, 2)}m`;
    } else {
      app.elements.coordinates.textContent = "";
    }
  }

  if (app.state.isPanning) {
    app.state.pan.x = e.clientX - app.state.panStart.x;
    app.state.pan.y = e.clientY - app.state.panStart.y;
    render(app);
    return;
  }

  if (!app.state.drag || app.state.selectedGroupIndex < 0 || app.state.selectedPoseIndex < 0) return;
  const p = getSelectedPose(app.state);
  if (!p) return;

  if (app.state.drag.mode === "move") {
    p.x = clamp(f.x, 0, m.fieldLengthMeters);
    p.y = clamp(f.y, 0, m.fieldWidthMeters);
  } else {
    p.thetaDegrees = radiansToDegrees(Math.atan2(f.y - p.y, f.x - p.x));
  }
  updateInputsFromSelection(app);
  render(app);
}

function onPointerUp(app) {
  const wasDragging = app.state.drag !== null;
  app.state.drag = null;
  app.state.isPanning = false;
  app.state.panStart = null;
  app.elements.canvas.style.cursor = "default";

  if (wasDragging) {
    saveToLocalStorage(app.state);
  }
}

function onDoubleClick(app, e) {
  if (!app.state.fieldMetrics) return;
  const ptr = getPointerPixel(app.state, app.elements, e);
  const f = pixelToField(app.state, app.elements, ptr.x, ptr.y);
  const m = app.state.fieldMetrics;
  if (f.x >= 0 && f.x <= m.fieldLengthMeters && f.y >= 0 && f.y <= m.fieldWidthMeters) {
    addPoseAt(app, f.x, f.y);
  }
}

function onKeyDown(app, e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo(app);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "Z" || e.key === "y")) {
    e.preventDefault();
    redo(app);
    return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && app.state.selectedGroupIndex >= 0 &&
      !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    deleteSelectedPose(app);
  }
  if (e.key === "Escape") {
    app.selectPose(-1, -1);
    render(app);
  }
}

function saveUndoState(state) {
  state.undoStack.push(JSON.stringify(state.groups));
  state.redoStack = [];
  if (state.undoStack.length > 50) state.undoStack.shift();
}

function undo(app) {
  if (!app.state.undoStack.length) return;
  app.state.redoStack.push(JSON.stringify(app.state.groups));
  app.state.groups = JSON.parse(app.state.undoStack.pop());
  syncGroupFilter(app.state);
  selectFirstPose(app.state);
  saveToLocalStorage(app.state);
  updateInputsFromSelection(app);
  render(app);
  app.setStatus("Undo");
}

function redo(app) {
  if (!app.state.redoStack.length) return;
  app.state.undoStack.push(JSON.stringify(app.state.groups));
  app.state.groups = JSON.parse(app.state.redoStack.pop());
  syncGroupFilter(app.state);
  selectFirstPose(app.state);
  saveToLocalStorage(app.state);
  updateInputsFromSelection(app);
  render(app);
  app.setStatus("Redo");
}

function findPoseNear(app, ptr) {
  let best = null;
  let bestD = Infinity;
  const thresh = 40;
  app.state.groups.forEach((group, groupIndex) => {
    const visible =
      app.state.groupFilter.size === 0 || app.state.groupFilter.has(group.name);
    if (!visible) return;
    group.poses.forEach((pose, poseIndex) => {
      const d = distance(ptr, fieldToPixel(app.state, app.elements, pose.x, pose.y));
      if (d < thresh && d < bestD) {
        best = { group, groupIndex, pose, poseIndex };
        bestD = d;
      }
    });
  });
  return best;
}
