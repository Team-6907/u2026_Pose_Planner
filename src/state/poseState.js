export function createState() {
  return {
    fieldConfig: null,
    fieldMetrics: null,
    image: null,
    groups: [],
    selectedGroupIndex: -1,
    selectedPoseIndex: -1,
    groupFilter: new Set(),
    drag: null,
    pan: { x: 0, y: 0 },
    isPanning: false,
    panStart: null,
    robot: { lengthMeters: 0.975, widthMeters: 0.82 },
    undoStack: [],
    redoStack: []
  };
}

export function pickGroupColor(index) {
  const palette = [
    "#4f46e5",
    "#38bdf8",
    "#f97316",
    "#22c55e",
    "#f43f5e",
    "#eab308",
    "#8b5cf6",
    "#14b8a6"
  ];
  return palette[index % palette.length];
}

export function getSelectedPose(state) {
  const group = state.groups[state.selectedGroupIndex];
  if (!group) return null;
  return group.poses[state.selectedPoseIndex] ?? null;
}

export function getSelectedGroupName(state) {
  const group = state.groups[state.selectedGroupIndex];
  return group ? group.name : null;
}

export function getTotalPoseCount(state) {
  return state.groups.reduce((sum, group) => sum + group.poses.length, 0);
}

export function getVisiblePoseEntries(state, includeAll = false) {
  const entries = [];
  state.groups.forEach((group, groupIndex) => {
    const visible =
      includeAll || state.groupFilter.size === 0 || state.groupFilter.has(group.name);
    if (!visible) return;
    group.poses.forEach((pose, poseIndex) => {
      entries.push({ group, groupIndex, pose, poseIndex });
    });
  });
  return entries;
}

export function isSelected(state, groupIndex, poseIndex) {
  return (
    groupIndex === state.selectedGroupIndex &&
    poseIndex === state.selectedPoseIndex
  );
}

export function hasPoseName(state, name) {
  return state.groups.some((group) => group.poses.some((pose) => pose.name === name));
}

export function createDefaultName(state) {
  let i = getTotalPoseCount(state) + 1;
  while (hasPoseName(state, `Pose ${i}`)) i++;
  return `Pose ${i}`;
}

export function syncGroupFilter(state) {
  const groupNames = new Set(state.groups.map((group) => group.name));
  [...state.groupFilter].forEach((name) => {
    if (!groupNames.has(name)) {
      state.groupFilter.delete(name);
    }
  });
}

export function ensureSelectionVisible(state) {
  if (state.selectedGroupIndex < 0 || state.selectedPoseIndex < 0) return;
  const group = state.groups[state.selectedGroupIndex];
  if (!group) {
    selectPose(state, -1, -1);
    return;
  }
  if (state.groupFilter.size > 0 && !state.groupFilter.has(group.name)) {
    selectPose(state, -1, -1);
  }
}

export function ensureGroup(state, name) {
  let groupIndex = state.groups.findIndex((group) => group.name === name);
  if (groupIndex >= 0) {
    return { group: state.groups[groupIndex], groupIndex };
  }
  const group = {
    name,
    color: pickGroupColor(state.groups.length),
    poses: []
  };
  state.groups.push(group);
  groupIndex = state.groups.length - 1;
  return { group, groupIndex };
}

export function getTargetGroupForNewPose(state) {
  if (state.selectedGroupIndex >= 0) {
    const selectedGroup = state.groups[state.selectedGroupIndex];
    if (selectedGroup) {
      return { group: selectedGroup, groupIndex: state.selectedGroupIndex };
    }
  }
  if (state.groupFilter.size === 1) {
    const name = [...state.groupFilter][0];
    return ensureGroup(state, name);
  }
  if (state.groups.length === 0) {
    return ensureGroup(state, "Default");
  }
  return { group: state.groups[0], groupIndex: 0 };
}

export function selectPose(state, groupIndex, poseIndex) {
  state.selectedGroupIndex = groupIndex;
  state.selectedPoseIndex = poseIndex;
}

export function selectFirstPose(state) {
  const entries = getVisiblePoseEntries(state);
  if (entries.length === 0) {
    selectPose(state, -1, -1);
    return;
  }
  selectPose(state, entries[0].groupIndex, entries[0].poseIndex);
}

export function parsePoseList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((pose, index) => ({
    name: String(pose.name ?? `Pose ${index + 1}`),
    x: Number(pose.x ?? 0),
    y: Number(pose.y ?? 0),
    thetaDegrees: Number(pose.thetaDegrees ?? pose.theta ?? 0)
  }));
}
