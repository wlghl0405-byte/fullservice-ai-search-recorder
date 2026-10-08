import type { NextApiRequest, NextApiResponse } from 'next';
import { saveTimeline, getTimeline } from '../../lib/timeline';
import { createDefaultTimeline } from '../../lib/defaultData';
import { TimelineStage } from '../../lib/types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { exam_id } = req.query;
    if (!exam_id || typeof exam_id !== 'string') {
      return res.status(400).json({ error: 'exam_id 필요' });
    }
    const stages = getTimeline(exam_id);
    return res.status(200).json({ stages });
  }

  if (req.method === 'POST') {
    const { exam_id, stages } = req.body as { exam_id: string; stages: TimelineStage[] };
    if (!exam_id) return res.status(400).json({ error: 'exam_id 필요' });
    saveTimeline(exam_id, stages);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { exam_id } = req.body as { exam_id: string };
    if (!exam_id) return res.status(400).json({ error: 'exam_id 필요' });
    saveTimeline(exam_id, createDefaultTimeline(exam_id));
    return res.status(200).json({ success: true, message: '기본 타임라인으로 초기화됨' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
