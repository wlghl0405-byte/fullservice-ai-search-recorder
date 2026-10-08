import type { NextApiRequest, NextApiResponse } from 'next';
import { runSearch } from '../../lib/megastudySearch';
import { loadResults, saveResults, loadLogs, saveLogs } from '../../lib/storage';
import { TestQuery } from '../../lib/types';

export const config = { api: { bodyParser: { sizeLimit: '5mb' }, responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { exam_id, exam_name, stage_name, queries } = req.body as {
    exam_id: string;
    exam_name: string;
    stage_name: string;
    queries: TestQuery[];
  };

  if (!exam_id || !exam_name || !stage_name || !queries?.length) {
    return res.status(400).json({ error: '필수 파라미터 누락 (exam_id, exam_name, stage_name, queries)' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  try {
    const { results, logs } = await runSearch({
      exam_id,
      exam_name,
      stage_name,
      queries,
      onProgress: (current, total, query_text) => {
        send({ type: 'progress', current, total, query_text });
      },
    });

    const existingResults = loadResults();
    saveResults([...existingResults, ...results]);

    const existingLogs = loadLogs();
    saveLogs([...existingLogs, ...logs]);

    send({ type: 'complete', results, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send({ type: 'error', error: message });
  } finally {
    res.end();
  }
}
