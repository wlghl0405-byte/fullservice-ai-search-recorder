import type { NextApiRequest, NextApiResponse } from 'next';
import { loadQueries, saveQueries } from '../../lib/storage';
import { parseExcelBuffer } from '../../lib/querySet';
import { TestQuery } from '../../lib/types';
import { v4 as uuidv4 } from 'uuid';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const queries = loadQueries();
    return res.status(200).json({ queries });
  }

  if (req.method === 'POST') {
    const { action, query, queries: bulkQueries, fileBase64, exam_id, query_ids, url } = req.body as {
      action: 'add' | 'update' | 'delete' | 'bulk' | 'upload' | 'delete_selected' | 'delete_all' | 'import_gsheet';
      query?: TestQuery;
      queries?: TestQuery[];
      fileBase64?: string;
      exam_id?: string;
      query_ids?: string[];
      url?: string;
    };

    const current = loadQueries();

    if (action === 'add' && query) {
      query.query_id = query.query_id || uuidv4();
      current.push(query);
      saveQueries(current);
      return res.status(200).json({ success: true, queries: current });
    }

    if (action === 'update' && query) {
      const idx = current.findIndex((q) => q.query_id === query.query_id);
      if (idx === -1) return res.status(404).json({ error: '질의를 찾을 수 없음' });
      current[idx] = query;
      saveQueries(current);
      return res.status(200).json({ success: true, queries: current });
    }

    if (action === 'delete' && query) {
      const filtered = current.filter((q) => q.query_id !== query.query_id);
      saveQueries(filtered);
      return res.status(200).json({ success: true, queries: filtered });
    }

    if (action === 'bulk' && bulkQueries) {
      const merged = [...current];
      for (const q of bulkQueries) {
        const existing = merged.findIndex((m) => m.query_id === q.query_id);
        if (existing >= 0) merged[existing] = q;
        else merged.push(q);
      }
      saveQueries(merged);
      return res.status(200).json({ success: true, queries: merged });
    }

    if (action === 'delete_selected' && query_ids?.length) {
      const keySet = new Set(query_ids);
      const remaining = current.filter((q) => !keySet.has(q.query_id));
      saveQueries(remaining);
      return res.status(200).json({ success: true, queries: remaining });
    }

    if (action === 'delete_all') {
      saveQueries([]);
      return res.status(200).json({ success: true, queries: [] });
    }

    if (action === 'upload' && fileBase64 && exam_id) {
      const buffer = Buffer.from(fileBase64, 'base64');
      const { queries: parsed, errors } = parseExcelBuffer(buffer, exam_id);
      if (errors.length > 0 && parsed.length === 0) {
        return res.status(400).json({ errors });
      }
      return res.status(200).json({ success: true, queries: parsed, errors });
    }

    if (action === 'import_gsheet' && url) {
      // 시트 ID 추출
      const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!sheetIdMatch) {
        return res.status(400).json({ errors: ['유효하지 않은 구글 시트 URL입니다.'] });
      }
      const sheetId = sheetIdMatch[1];
      const gidMatch = url.match(/[#&?]gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

      try {
        const response = await fetch(exportUrl);
        if (!response.ok) {
          return res.status(400).json({
            errors: ['구글 시트를 가져올 수 없습니다. 시트가 "링크가 있는 누구나" 공개 상태인지 확인하세요.'],
          });
        }
        const csvText = await response.text();
        const { queries: parsed, errors } = parseExcelBuffer(csvText, exam_id || '');
        if (errors.length > 0 && parsed.length === 0) {
          return res.status(400).json({ errors });
        }
        return res.status(200).json({ success: true, queries: parsed, errors });
      } catch (err) {
        return res.status(500).json({ errors: ['구글 시트 가져오기 오류: ' + String(err)] });
      }
    }

    return res.status(400).json({ error: '알 수 없는 action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
