import type { NextApiRequest, NextApiResponse } from 'next';
import { loadResults, saveVerdictForResult } from '../../lib/storage';
import { runVerdict } from '../../lib/verdictEngine';
import { SearchResult } from '../../lib/types';

export const config = { api: { bodyParser: { sizeLimit: '1mb' }, responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { target } = req.body as {
    // 'all' | 'run_id:<id>' | 'selected:<run_id>|<query_id>,…'
    target: string;
  };

  if (!target) {
    return res.status(400).json({ error: 'target 파라미터 필요' });
  }

  const allResults = loadResults();

  let targets: SearchResult[];
  if (target === 'all') {
    targets = allResults;
  } else if (target.startsWith('run_id:')) {
    const run_id = target.replace('run_id:', '');
    targets = allResults.filter((r) => r.run_id === run_id);
  } else if (target.startsWith('selected:')) {
    const keys = new Set(target.replace('selected:', '').split(','));
    targets = allResults.filter((r) => keys.has(`${r.run_id}|${r.query_id}`));
  } else {
    return res.status(400).json({ error: '알 수 없는 target 형식' });
  }

  if (targets.length === 0) {
    return res.status(400).json({ error: '판정 대상 결과 없음' });
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

  const verdictResults: Array<{ run_id: string; query_id: string; verdict: import('../../lib/types').VerdictResult }> = [];

  try {
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      send({ type: 'progress', current: i + 1, total: targets.length, query_text: r.query_text });

      const verdict = await runVerdict({
        stage_name: r.stage_name,
        category: r.category,
        query_text: r.query_text,
        answer_text: r.answer_text,
        source_links: r.source_links,
        collection_status: r.collection_status,
      });

      const collectionStatus =
        verdict.collection_failure && r.collection_status === '수집 성공'
          ? '수집 실패'
          : undefined;
      saveVerdictForResult(r.run_id, r.query_id, verdict, collectionStatus);
      verdictResults.push({ run_id: r.run_id, query_id: r.query_id, verdict });

      send({
        type: 'result',
        run_id: r.run_id,
        query_id: r.query_id,
        verdict,
      });
    }

    send({ type: 'complete', total: targets.length, results: verdictResults });
  } catch (err) {
    send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
}
