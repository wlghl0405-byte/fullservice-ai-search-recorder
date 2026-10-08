import React, { useState } from 'react';
import { TestQuery, SearchResult, ExecutionLog } from '../lib/types';

interface Props {
  examId: string;
  examName: string;
  selectedStage: string;
  allQueries: TestQuery[];
  selectedQueryIds: Set<string>;
  onComplete: (results: SearchResult[], logs: ExecutionLog[]) => void;
}

interface Progress {
  current: number;
  total: number;
  queryText: string;
}

export default function SearchRunner({
  examId, examName, selectedStage, allQueries, selectedQueryIds, onComplete,
}: Props) {
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'selected' | 'all'>('selected');
  const [progress, setProgress] = useState<Progress | null>(null);

  const selectedQueries = allQueries.filter((q) => q.exam_id === examId && selectedQueryIds.has(q.query_id));
  const allExamQueries = allQueries.filter((q) => q.exam_id === examId);

  const targetQueries = mode === 'selected' ? selectedQueries : allExamQueries;

  const handleRun = async () => {
    if (!examId) return alert('시험 회차를 선택하세요.');
    if (!selectedStage) return alert('타임라인에서 현재 실행 단계를 선택하세요.');
    if (targetQueries.length === 0) return alert('실행할 질의가 없습니다.');
    if (!confirm(`총 ${targetQueries.length}개 질의를 실행하시겠습니까?\n질의 간 5~10초 대기가 있어 시간이 소요될 수 있습니다.`)) return;

    setRunning(true);
    setError('');
    setStatusMsg('');
    setProgress({ current: 0, total: targetQueries.length, queryText: '' });

    try {
      const res = await fetch('/api/run-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: examId,
          exam_name: examName,
          stage_name: selectedStage,
          queries: targetQueries,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: '서버 오류 발생' }));
        setError(data.error || '서버 오류 발생');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'progress') {
              setProgress({ current: event.current, total: event.total, queryText: event.query_text });
            } else if (event.type === 'complete') {
              const successCount = event.results.filter((r: SearchResult) => r.collection_status === '수집 성공').length;
              const failCount = event.results.length - successCount;
              setStatusMsg(`완료: 총 ${event.results.length}건 (성공 ${successCount} / 실패 ${failCount})`);
              setProgress(null);
              onComplete(event.results, event.logs);
            } else if (event.type === 'error') {
              setError(event.error || '서버 오류 발생');
            }
          } catch {
            // 파싱 실패 라인 무시
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setRunning(false);
    }
  };

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <section className="section">
      <div className="section-header">
        <h2>4. 검색 실행</h2>
      </div>
      <div className="run-info">
        <table className="table info-table">
          <tbody>
            <tr>
              <th>시험 회차</th>
              <td>{examName || '—'}</td>
              <th>실행 단계</th>
              <td>{selectedStage || '—'}</td>
            </tr>
            <tr>
              <th>전체 질의</th>
              <td>{allExamQueries.length}건</td>
              <th>선택 질의</th>
              <td>{selectedQueries.length}건</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="run-controls">
        <label>
          <input type="radio" name="mode" value="selected" checked={mode === 'selected'} onChange={() => setMode('selected')} />
          &nbsp;선택한 질의만 실행 ({selectedQueries.length}건)
        </label>
        <label>
          <input type="radio" name="mode" value="all" checked={mode === 'all'} onChange={() => setMode('all')} />
          &nbsp;전체 질의 실행 ({allExamQueries.length}건)
        </label>
      </div>

      <button
        className="btn btn-primary btn-large"
        onClick={handleRun}
        disabled={running}
      >
        {running ? '실행 중...' : '검색 실행'}
      </button>

      {running && progress && (
        <div className="progress-wrapper">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: progress.current === 0 ? '0%' : `${pct}%`, transition: 'width 0.4s ease' }}
            />
          </div>
          <div className="progress-meta">
            <span className="progress-count">
              {progress.current === 0
                ? `0 / ${progress.total}건 준비 중...`
                : `${progress.current} / ${progress.total}번째 질의 처리 중`}
            </span>
            <span className="progress-pct">{pct}%</span>
          </div>
          {progress.queryText && (
            <p className="progress-query-text">&ldquo;{progress.queryText}&rdquo;</p>
          )}
        </div>
      )}

      {statusMsg && <p className={`status-msg ${error ? 'status-error' : 'status-ok'}`}>{statusMsg}</p>}
      {error && <p className="status-msg status-error">오류: {error}</p>}

      <div className="run-notice">
        <strong>주의사항</strong>
        <ul>
          <li>실제 메가스터디 AI검색 페이지에 접속하여 질의를 자동 입력합니다.</li>
          <li>질의 간 5~10초 대기 시간이 있습니다.</li>
          <li>AI 답변 최대 대기 시간은 30초입니다.</li>
          <li>실패한 질의는 1회 재시도 후 실패로 기록됩니다.</li>
          <li>중간 실패가 발생해도 전체 실행을 중단하지 않습니다.</li>
        </ul>
      </div>
    </section>
  );
}
