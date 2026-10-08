import { TimelineStage } from './types';
import { createDefaultTimeline } from './defaultData';
import { loadTimelines, saveTimelines } from './storage';

export function getTimeline(exam_id: string): TimelineStage[] {
  const all = loadTimelines();
  if (all[exam_id] && all[exam_id].length > 0) {
    return all[exam_id].sort((a, b) => a.stage_order - b.stage_order);
  }
  return createDefaultTimeline(exam_id);
}

export function saveTimeline(exam_id: string, stages: TimelineStage[]) {
  const all = loadTimelines();
  all[exam_id] = stages;
  saveTimelines(all);
}
