import { FIELD_ASSET } from "../field/fieldAsset.js";
import { parsePoseList, pickGroupColor, selectFirstPose, syncGroupFilter, getTotalPoseCount } from "../state/poseState.js";
import { round } from "../utils/math.js";

// Auto-load is disabled in standalone version
// Users should import poses.json via copy-paste or file import
export async function loadDefaultPoses(app) {
  // No default poses to load in standalone version
  console.info("Ready to import poses via copy-paste or file upload");
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
