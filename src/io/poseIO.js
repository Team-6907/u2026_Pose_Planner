import { FIELD_ASSET } from "../field/fieldAsset.js";
import { parsePoseList, pickGroupColor, selectFirstPose, syncGroupFilter, getTotalPoseCount } from "../state/poseState.js";
import { round } from "../utils/math.js";

const STORAGE_KEY = "goatlib-pose-planner-state";

// Auto-load from localStorage on startup
export async function loadDefaultPoses(app) {
  const saved = loadFromLocalStorage();
  if (saved) {
    app.state.groups = saved;
    syncGroupFilter(app.state);
    selectFirstPose(app.state);
    app.setStatus(`Loaded ${getTotalPoseCount(app.state)} poses from browser storage.`);
  } else {
    console.info("Ready to import poses via paste or file upload");
  }
}

export function parsePosePayload(data) {
  if (Array.isArray(data?.groups)) {
    return data.groups.map((group, groupIndex) => ({
      name: String(group.name ?? `Group ${groupIndex + 1}`),
      color: group.color ?? pickGroupColor(groupIndex),
      poses: parsePoseList(group.poses ?? [])
    }));
  }

  const arr = Array.isArray(data) ? data : data?.poses;
  if (Array.isArray(arr)) {
    return [
      {
        name: "Default",
        color: pickGroupColor(0),
        poses: parsePoseList(arr)
      }
    ];
  }

  return [];
}

export function buildPosePayload(state) {
  return {
    schemaVersion: 1,
    field: FIELD_ASSET.id,
    units: "meters",
    thetaUnits: "degrees",
    groups: state.groups.map((group) => ({
      name: group.name,
      color: group.color ?? undefined,
      poses: group.poses.map((p) => ({
        name: p.name,
        x: round(p.x, 3),
        y: round(p.y, 3),
        thetaDegrees: round(p.thetaDegrees, 1)
      }))
    }))
  };
}

// LocalStorage functions
export function saveToLocalStorage(state) {
  try {
    const data = buildPosePayload(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
    return false;
  }
}

export function loadFromLocalStorage() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    const data = JSON.parse(json);
    return parsePosePayload(data);
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
    return null;
  }
}

export function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear localStorage:", error);
    return false;
  }
}

