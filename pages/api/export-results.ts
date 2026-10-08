import type { NextApiRequest, NextApiResponse } from 'next';
import { loadResults, loadLogs, loadQueries, loadTimelines } from '../../lib/storage';
import { buildExcelBuffer, generateFileName } from '../../lib/excelExport';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results = loadResults();
  const logs = loadLogs();
  const queries = loadQueries();
  const timelines = loadTimelines();

  const buffer = buildExcelBuffer(results, logs, queries, timelines);
  const fileName = generateFileName();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader('Content-Length', buffer.length);
  res.status(200).send(buffer);
}
