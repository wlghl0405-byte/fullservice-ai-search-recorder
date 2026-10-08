import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { SearchResult, VerdictResult, VerdictStatus } from '../lib/types';
import { RUBRIC_RULES } from '../lib/rubric';

export interface VerdictPanelHandle {
  runVerdictForKeys: (keys: Set<string>) => void;
}

interface Props {
  allResults: SearchResult[];
  selectedExamName?: string;
  selectedKeys: Set<string>;
  onVerdictComplete: (updated: Array<{ run_id: string; query_id: string; verdict: VerdictResult }>) => void;
  onVerdictDelete: (updatedResults: SearchResult[]) => void;
  onRunningChange?: (running: boolean) => void;
}

type TabKey = 'correction' | 'review';
type RubricTabKey = 'timeline' | 'lecture';

const ERROR_TYPE_LABEL: Record<string, string> = {
  '미공개_정보_확정_안내': '미공개 정보 확정 안내',
  '필수_문구_누락': '필수 문구 누락',
  '풀서비스_링크_누락': '풀서비스 링크 누락',
  '테이블_형식_누락': '테이블 형식 누락',
  '산출기준_누락': '산출기준 누락',
  '산출기준_불필요': '산출기준 불필요',
  '용어_오류': '용어 오류',
  '시험_범위_오류': '시험 범위 오류',
  '절대평가_오류': '절대평가 오류',
  '개인화_데이터_오류': '개인화 데이터 오류',
  '구조_불적절': '구조 불적절',
  '기타': '기타',
};

const STAGE_ORDER_LABEL: Record<number, string> = {
  0: '전체 공통',
  1: '시험 종료 전',
  2: '시험 종료',
  3: '사전 채점 오픈',
  4: '정답 공개',
  5: '채점 서비스 오픈',
  6: '국어, 수학 1차 등급컷 오픈',
  7: '사탐, 과탐 1차 등급컷 오픈',
  8: '메가스터디 자체 등급컷 확정',
};

function rowKey(r: SearchResult) {
  return `${r.run_id}|${r.query_id}`;
}

const VerdictPanel = forwardRef<VerdictPanelHandle, Props>(
  ({ allResults, selectedExamName, selectedKeys, onVerdictComplete, onVerdictDelete, onRunningChange }, ref) => {
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, query_text: '' });
    const [tab, setTab] = useState<TabKey>('correction');
    const [statusMsg, setStatusMsg] = useState('');
    const [showRubric, setShowRubric] = useState(false);
    const [rubricTab, setRubricTab] = useState<RubricTabKey>('timeline');
    const [selectedCorrectionKeys, setSelectedCorrectionKeys] = useState<Set<string>>(new Set());
    const [selectedReviewKeys, setSelectedReviewKeys] = useState<Set<string>>(new Set());

    const examResults = selectedExamName
      ? allResults.filter((r) => r.exam_name === selectedExamName)
      : allResults;
    const verdicted = examResults.filter((r) => r.verdict && r.verdict.verdict_status !== '미판정');
    const passCount = verdicted.filter((r) => r.verdict?.verdict_status === '통과').length;
    const correctionItems = verdicted.filter((r) => r.verdict?.verdict_status === '수정 필요');
    const reviewItems = verdicted.filter((r) => r.verdict?.verdict_status === '재검수 필요');

    const execVerdict = useCallback(async (target: string) => {
      setRunning(true);
      onRunningChange?.(true);
      setProgress({ current: 0, total: 0, query_text: '' });
      setStatusMsg('');

      try {
        const res = await fetch('/api/run-verdict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target }),
        });

        if (!res.ok || !res.body) {
          const err = await res.text();
          setStatusMsg(`오류: ${err}`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const updates: Array<{ run_id: string; query_id: string; verdict: VerdictResult }> = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'progress') {
                setProgress({ current: event.current, total: event.total, query_text: event.query_text });
              } else if (event.type === 'result') {
                updates.push({ run_id: event.run_id, query_id: event.query_id, verdict: event.verdict });
              } else if (event.type === 'complete') {
                onVerdictComplete(updates);
                setStatusMsg(`판정 완료 — ${event.total}건 처리됨`);
              } else if (event.type === 'error') {
                setStatusMsg(`오류: ${event.error}`);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } catch (err) {
        setStatusMsg(`요청 오류: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setRunning(false);
        onRunningChange?.(false);
      }
    }, [onVerdictComplete, onRunningChange]);

    const handleRunAll = () => execVerdict('all');

    const handleClearVerdictSelected = async () => {
      const ids = [
        ...Array.from(selectedCorrectionKeys),
        ...Array.from(selectedReviewKeys),
      ].map((k) => {
        const [run_id, query_id] = k.split('|');
        return { run_id, query_id };
      });
      if (ids.length === 0) return;
      if (!confirm(`선택한 ${ids.length}건의 판정 결과를 삭제하시겠습니까?`)) return;
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_verdict_selected', ids }),
      });
      const data = await res.json();
      setSelectedCorrectionKeys(new Set());
      setSelectedReviewKeys(new Set());
      onVerdictDelete(data.results || []);
    };

    const handleClearVerdictAll = async () => {
      const label = selectedExamName ? `"${selectedExamName}"` : '전체';
      if (!confirm(`${label}의 판정 결과를 모두 삭제하시겠습니까?`)) return;
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_verdict_all', exam_name: selectedExamName }),
      });
      const data = await res.json();
      setSelectedCorrectionKeys(new Set());
      setSelectedReviewKeys(new Set());
      onVerdictDelete(data.results || []);
    };

    const handleRunSelected = useCallback(() => {
      if (selectedKeys.size === 0) return;
      execVerdict('selected:' + Array.from(selectedKeys).join(','));
    }, [selectedKeys, execVerdict]);

    // 외부(ResultTable)에서 선택 판정 트리거
    useImperativeHandle(ref, () => ({
      runVerdictForKeys: (keys: Set<string>) => {
        if (keys.size === 0) return;
        if (keys.has('__all__')) {
          execVerdict('all');
        } else {
          execVerdict('selected:' + Array.from(keys).join(','));
        }
      },
    }), [execVerdict]);

    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    const selectedCount = selectedCorrectionKeys.size + selectedReviewKeys.size;
    const hasVerdicted = correctionItems.length > 0 || reviewItems.length > 0;

    const downloadVerdict = async (target: 'all' | 'selected') => {
      const keys = target === 'selected'
        ? [...selectedCorrectionKeys, ...selectedReviewKeys]
        : undefined;
      const res = await fetch('/api/export-verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, keys }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename\*=UTF-8''(.+)/);
      const fileName = match ? decodeURIComponent(match[1]) : 'verdict_corrections.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    };

    // 루브릭 데이터: 단계 순서별 그룹
    const stageOrders = Array.from(new Set(RUBRIC_RULES.map((r) => r.stage_order))).sort((a, b) => a - b);

    return (
      <>
        <section className="section">
          <div className="section-header">
            <h2>6. 답변 품질 판정</h2>
            <div className="btn-group">
              <button
                className="btn btn-sm btn-rubric"
                onClick={() => setShowRubric(true)}
              >
                루브릭 보기
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => downloadVerdict('selected')}
                disabled={selectedCount === 0}
              >
                선택 다운로드{selectedCount > 0 ? ` (${selectedCount}건)` : ''}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => downloadVerdict('all')}
                disabled={!hasVerdicted}
              >
                전체 다운로드
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={handleClearVerdictSelected}
                disabled={selectedCount === 0}
              >
                선택 판정 삭제{selectedCount > 0 ? ` (${selectedCount}건)` : ''}
              </button>
              <button
                className="btn btn-sm btn-danger-outline"
                onClick={handleClearVerdictAll}
                disabled={!hasVerdicted}
              >
                전체 판정 삭제
              </button>
            </div>
          </div>

          {running && (
            <div className="progress-wrapper">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-meta">
                <span className="progress-count">{progress.current} / {progress.total}</span>
                <span className="progress-pct">{pct}%</span>
              </div>
              {progress.query_text && (
                <div className="progress-query-text">판정 중: {progress.query_text}</div>
              )}
            </div>
          )}

          {statusMsg && (
            <div className={`status-msg ${statusMsg.startsWith('오류') ? 'status-error' : 'status-ok'}`}>
              {statusMsg}
            </div>
          )}

          {verdicted.length > 0 && (
            <>
              <div className="verdict-summary">
                <div className="verdict-stat">
                  <span className="verdict-stat-num">{verdicted.length}</span>
                  <span className="verdict-stat-label">판정 완료</span>
                </div>
                <div className="verdict-stat verdict-stat--pass">
                  <span className="verdict-stat-num">{passCount}</span>
                  <span className="verdict-stat-label">통과</span>
                </div>
                <div className="verdict-stat verdict-stat--correction">
                  <span className="verdict-stat-num">{correctionItems.length}</span>
                  <span className="verdict-stat-label">수정 필요</span>
                </div>
                <div className="verdict-stat verdict-stat--review">
                  <span className="verdict-stat-num">{reviewItems.length}</span>
                  <span className="verdict-stat-label">재검수 필요</span>
                </div>
              </div>

              <div className="verdict-tabs">
                <button
                  className={`verdict-tab ${tab === 'correction' ? 'active' : ''}`}
                  onClick={() => setTab('correction')}
                >
                  수정 요청 목록 ({correctionItems.length}건)
                </button>
                <button
                  className={`verdict-tab ${tab === 'review' ? 'active' : ''}`}
                  onClick={() => setTab('review')}
                >
                  재검수 대상 ({reviewItems.length}건)
                </button>
              </div>

              {tab === 'correction' && (
                <CorrectionTable
                  items={correctionItems}
                  selectedKeys={selectedCorrectionKeys}
                  onSelectionChange={setSelectedCorrectionKeys}
                />
              )}
              {tab === 'review' && (
                <ReviewTable
                  items={reviewItems}
                  selectedKeys={selectedReviewKeys}
                  onSelectionChange={setSelectedReviewKeys}
                />
              )}
            </>
          )}

          {!running && verdicted.length === 0 && (
            <div className="hint" style={{ marginTop: 8 }}>
              수집 결과 테이블에서 행을 선택한 뒤 <strong>선택 판정 실행</strong>을 누르거나,
              <strong>전체 판정 실행</strong>으로 모든 수집 결과를 한 번에 판정할 수 있습니다.
            </div>
          )}
        </section>

        {/* 루브릭 뷰어 모달 */}
        {showRubric && (
          <div className="modal-overlay" onClick={() => setShowRubric(false)}>
            <div className="modal modal-rubric" onClick={(e) => e.stopPropagation()}>
              <div className="modal-rubric-header">
                <h3>검수 루브릭</h3>
                <button className="btn btn-sm" onClick={() => setShowRubric(false)}>닫기</button>
              </div>

              <div className="verdict-tabs" style={{ marginBottom: 16 }}>
                <button
                  className={`verdict-tab ${rubricTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => setRubricTab('timeline')}
                >
                  타임라인 루브릭
                </button>
                <button
                  className={`verdict-tab ${rubricTab === 'lecture' ? 'active' : ''}`}
                  onClick={() => setRubricTab('lecture')}
                >
                  해설강의 · 라이브 루브릭
                </button>
              </div>

              {rubricTab === 'timeline' && (
                <div className="rubric-content">
                  {stageOrders.map((order) => {
                    const rules = RUBRIC_RULES.filter((r) => r.stage_order === order);
                    return (
                      <div key={order} className="rubric-stage-group">
                        <div className="rubric-stage-title">
                          {order === 0 ? '전체 공통' : `${order}단계 — ${STAGE_ORDER_LABEL[order] || ''}`}
                        </div>
                        <table className="table rubric-table">
                          <thead>
                            <tr>
                              <th style={{ width: 70 }}>유형</th>
                              <th style={{ width: 160 }}>질의 설명</th>
                              <th>답변 기준</th>
                              <th>검수 포인트</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rules.map((rule, i) => (
                              <tr key={i}>
                                <td><span className="badge badge-correction">{rule.category}</span></td>
                                <td className="cell-sm">{rule.query_description}</td>
                                <td className="cell-md">{rule.answer_standard}</td>
                                <td className="cell-md rubric-inspection">{rule.inspection_point}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}

              {rubricTab === 'lecture' && (
                <div className="rubric-content">
                  <div className="hint" style={{ padding: 24, textAlign: 'center' }}>
                    해설강의 · 라이브 설명회 루브릭은 준비 중입니다.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }
);

VerdictPanel.displayName = 'VerdictPanel';
export default VerdictPanel;

function CorrectionTable({
  items,
  selectedKeys,
  onSelectionChange,
}: {
  items: SearchResult[];
  selectedKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
}) {
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const masterCheckRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginated = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageKeys = paginated.map((r) => `${r.run_id}|${r.query_id}`);
  const allSelected = pageKeys.length > 0 && pageKeys.every((k) => selectedKeys.has(k));
  const someSelected = pageKeys.some((k) => selectedKeys.has(k));

  useEffect(() => {
    if (masterCheckRef.current) {
      masterCheckRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleAll = () => {
    const next = new Set(selectedKeys);
    if (allSelected) {
      pageKeys.forEach((k) => next.delete(k));
    } else {
      pageKeys.forEach((k) => next.add(k));
    }
    onSelectionChange(next);
  };

  const toggleRow = (key: string) => {
    const next = new Set(selectedKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    onSelectionChange(next);
  };

  if (items.length === 0) {
    return <div className="no-data" style={{ padding: 16 }}>수정 요청 항목이 없습니다.</div>;
  }

  return (
    <>
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" ref={masterCheckRef} checked={allSelected} onChange={toggleAll} />
            </th>
            <th style={{ width: 140 }}>공개 단계</th>
            <th style={{ width: 80 }}>질의 유형</th>
            <th style={{ width: 200 }}>사용자 질의</th>
            <th style={{ width: 120 }}>오류 유형</th>
            <th style={{ width: 220 }}>문제 설명</th>
            <th>수정 요청 내용</th>
          </tr>
        </thead>
        <tbody>
          {paginated.flatMap((r) => {
            const issues = r.verdict?.issues || [];
            if (issues.length === 0) return [];
            const gKey = `${r.run_id}|${r.query_id}`;
            const isGroupHovered = hoveredGroup === gKey;
            const isSelected = selectedKeys.has(gKey);
            return issues.map((issue, idx) => {
              const key = `${gKey}|${idx}`;
              const isExpanded = expandedKey === key;
              return (
                <tr
                  key={key}
                  className={`${isGroupHovered ? 'row-hover-group' : ''} ${isSelected ? 'row-selected' : ''}`}
                  onMouseEnter={() => setHoveredGroup(gKey)}
                  onMouseLeave={() => setHoveredGroup(null)}
                >
                  {idx === 0 && (
                    <>
                      <td rowSpan={issues.length}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(gKey)} />
                      </td>
                      <td rowSpan={issues.length} className="cell-stage">{r.stage_name}</td>
                      <td rowSpan={issues.length}><span className="badge badge-correction">{r.category}</span></td>
                      <td rowSpan={issues.length} className="cell-query">{r.query_text}</td>
                    </>
                  )}
                  <td>
                    <span className="badge badge-error-type">
                      {ERROR_TYPE_LABEL[issue.error_type] || issue.error_type}
                    </span>
                  </td>
                  <td className="cell-sm">{issue.description}</td>
                  <td className="cell-md">
                    <div
                      className={isExpanded ? 'text-expanded' : 'text-collapsed'}
                      onClick={() => setExpandedKey(isExpanded ? null : key)}
                    >
                      {issue.correction_request}
                    </div>
                    <button className="btn btn-xs" onClick={() => setExpandedKey(isExpanded ? null : key)}>
                      {isExpanded ? '접기' : '펼치기'}
                    </button>
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
    {totalPages > 1 && (
      <div className="pagination">
        <button className="btn btn-sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>이전</button>
        <span className="pagination-info">{currentPage} / {totalPages} 페이지 (총 {items.length}건)</span>
        <button className="btn btn-sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>다음</button>
      </div>
    )}
    </>
  );
}

function ReviewTable({
  items,
  selectedKeys,
  onSelectionChange,
}: {
  items: SearchResult[];
  selectedKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
}) {
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const masterCheckRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginated = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageKeys = paginated.map((r) => rowKey(r));
  const allSelected = pageKeys.length > 0 && pageKeys.every((k) => selectedKeys.has(k));
  const someSelected = pageKeys.some((k) => selectedKeys.has(k));

  useEffect(() => {
    if (masterCheckRef.current) {
      masterCheckRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleAll = () => {
    const next = new Set(selectedKeys);
    if (allSelected) {
      pageKeys.forEach((k) => next.delete(k));
    } else {
      pageKeys.forEach((k) => next.add(k));
    }
    onSelectionChange(next);
  };

  const toggleRow = (key: string) => {
    const next = new Set(selectedKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    onSelectionChange(next);
  };

  if (items.length === 0) {
    return <div className="no-data" style={{ padding: 16 }}>재검수 대상이 없습니다.</div>;
  }

  return (
    <>
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" ref={masterCheckRef} checked={allSelected} onChange={toggleAll} />
            </th>
            <th style={{ width: 140 }}>공개 단계</th>
            <th style={{ width: 80 }}>질의 유형</th>
            <th style={{ width: 220 }}>사용자 질의</th>
            <th>판정 메모</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((r) => {
            const key = rowKey(r);
            const isSelected = selectedKeys.has(key);
            return (
              <tr key={key} className={isSelected ? 'row-selected' : ''}>
                <td>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleRow(key)} />
                </td>
                <td className="cell-stage">{r.stage_name}</td>
                <td><span className="badge badge-review">{r.category}</span></td>
                <td className="cell-query">{r.query_text}</td>
                <td className="cell-md">{r.verdict?.verdict_note || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {totalPages > 1 && (
      <div className="pagination">
        <button className="btn btn-sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>이전</button>
        <span className="pagination-info">{currentPage} / {totalPages} 페이지 (총 {items.length}건)</span>
        <button className="btn btn-sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>다음</button>
      </div>
    )}
    </>
  );
}
