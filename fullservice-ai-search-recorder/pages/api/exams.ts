import type { NextApiRequest, NextApiResponse } from 'next';
import { DEFAULT_EXAMS } from '../../lib/defaultData';
import { Exam } from '../../lib/types';
import fs from 'fs';
import path from 'path';

const DATA_BASE = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const EXAM_FILE = path.join(DATA_BASE, 'saved', 'exams.json');

function loadExams(): Exam[] {
  try {
    if (fs.existsSync(EXAM_FILE)) {
      return JSON.parse(fs.readFileSync(EXAM_FILE, 'utf-8'));
    }
  } catch {}
  return DEFAULT_EXAMS;
}

function saveExams(exams: Exam[]) {
  const dir = path.dirname(EXAM_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EXAM_FILE, JSON.stringify(exams, null, 2), 'utf-8');
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ exams: loadExams() });
  }

  if (req.method === 'POST') {
    const { action, exam } = req.body as { action: 'add' | 'update' | 'delete'; exam: Exam };
    const current = loadExams();

    if (action === 'add') {
      current.push(exam);
      saveExams(current);
      return res.status(200).json({ exams: current });
    }
    if (action === 'update') {
      const idx = current.findIndex((e) => e.exam_id === exam.exam_id);
      if (idx >= 0) current[idx] = exam;
      saveExams(current);
      return res.status(200).json({ exams: current });
    }
    if (action === 'delete') {
      const filtered = current.filter((e) => e.exam_id !== exam.exam_id);
      saveExams(filtered);
      return res.status(200).json({ exams: filtered });
    }
    return res.status(400).json({ error: '알 수 없는 action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
