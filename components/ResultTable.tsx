import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { SearchResult } from '../lib/types';

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!expanded && ref.current) {
      setOverflows(ref.current.scrollHeight > ref.current.clientHeight + 1);
    }
  }, [expanded, text]);

  return (
    <div className="expandable-cell">
      <div ref={ref} className={expanded ? 'text-expanded' : 'text-collapsed'}>
        {text}
      </div>
      {(overflows || expanded) && (
        <button className="btn btn-xs expandable-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '접기' : '펼치기'}
        </button>
      )}
    </div>
  );
}

interface Props {
  newResults: SearchResult[];
  parentResults?: SearchResult[];
  selectedExamName?: string;
  verdictUpdates?: Array<{ run_id: string; query_id: string; verdict: SearchResult['verdict'] }>;
  onSelectionChange?: (keys: Set<string>) => void;
  onRunVerdict?: (keys: Set<string>) => void;
  verdictRunning?: boolean;
}

const rowKey = (r: SearchResult) => `${r.run_id}|${r.query_id}`;

const VERDICT_BADGE: Record<string, string> = {
  '통과': 'badge-verdict-pass',
  '수정 필요': 'badge-verdict-correction',
  '재검수 필요': 'badge-verdict-review',
  '미판정': 'badge-verdict-none',
};

export default function ResultTable({ newResults, parentResults, selectedExamName, verdictUpdates, onSelectionChange, onRunVerdict, verdictRunning }: Props) {
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [filterExam, setFilterExam] = useState(selectedExamName ?? '');
  const [filterStage, setFilterStage] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVerdict, setFilterVerdict] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const masterCheckRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/results')
      .then((r) => r.json())
      .then((d) => setAllResults(d.results || []));
  }, []);

  useEffect(() => {
    setFilterExam(selectedExamName ?? '');
    setCurrentPage(1);
  }, [selectedExamName]);

  useEffect(() => {
    if (parentResults !== undefined) setAllResults(parentResults);
  }, [parentResults]);

  useEffect(() => {
    if (newResults.length > 0) {
      setAllResults((prev) => {
        const ids = new Set(newResults.map(rowKey));
        const deduped = prev.filter((r) => !ids.has(rowKey(r)));
        return [...newResults, ...deduped];
      });
    }
  }, [newResults]);

  useEffect(() => {
    if (verdictUpdates && verdictUpdates.length > 0) {
      setAllResults((prev) =>
        prev.map((r) => {
          const update = verdictUpdates.find(
            (u) => u.run_id === r.run_id && u.query_id === r.query_id,
          );
          return update ? { ...r, verdict: update.verdict } : r;
        }),
      );
    }
  }, [verdictUpdates]);

  // 선택 변경 시 부모에게 전달
  useEffect(() => {
    onSelectionChange?.(selectedKeys);
  }, [selectedKeys, onSelectionChange]);

  const exams = Array.from(new Set(allResults.map((r) => r.exam_name).filter(Boolean)));
  const stages = Array.from(new Set(allResults.map((r) => r.stage_name).filter(Boolean)));
  const categories = Array.from(new Set(allResults.map((r) => r.category).filter(Boolean)));

  const verdictStatus = (r: SearchResult) => r.verdict?.verdict_status ?? '미판정';

  const filtered = allResults.filter((r) => {
    if (filterExam && r.exam_name !== filterExam) return false;
    if (filterStage && r.stage_name !== filterStage) return false;
    if (filterCat && r.category !== filterCat) return false;
    if (filterStatus && r.collection_status !== filterStatus) return false;
    if (filterVerdict && verdictStatus(r) !== filterVerdict) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const allPageSelected = paginated.length > 0 && paginated.every((r) => selectedKeys.has(rowKey(r)));
  const somePageSelected = paginated.some((r) => selectedKeys.has(rowKey(r)));
  useEffect(() => {
    if (masterCheckRef.current) {
      masterCheckRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const updateKeys = (fn: (prev: Set<string>) => Set<string>) => {
    setSelectedKeys((prev) => {
      const next = fn(prev);
      return next;
    });
  };

  const toggleRow = (key: string) => {
    updateKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };


  const apiDelete = async (body: object) => {
    const res = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setAllResults(data.results || []);
    setSelectedKeys(new Set());
  };

  const handleDeleteSelected = async () => {
    const targets = filtered.filter((r) => selectedKeys.has(rowKey(r)));
    if (targets.length === 0) return;
    if (!confirm(`선택한 ${targets.length}건을 삭제하시겠습니까?`)) return;
    await apiDelete({
      action: 'delete_selected',
      ids: targets.map((r) => ({ run_id: r.run_id, query_id: r.query_id })),
    });
  };

  const handleDeleteOne = async (r: SearchResult) => {
    if (!confirm(`해당 수집 결과를 삭제하시겠습니까?\n"${r.query_text}"`)) return;
    await apiDelete({
      action: 'delete_selected',
      ids: [{ run_id: r.run_id, query_id: r.query_id }],
    });
  };

  const handleDeleteAll = async () => {
    if (!confirm(`전체 수집 결과 ${allResults.length}건을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    await apiDelete({ action: 'delete_all' });
  };

  const handleDownload = () => {
    window.open('/api/export-results', '_blank');
  };

  const parseLinks = (raw: string) => {
    try {
      return JSON.parse(raw) as { text: string; href: string }[];
    } catch {
      return [];
    }
  };

  const formatDatetime = (val: string) => {
    const [date, time] = val.split('T');
    return { date: date ?? val, time: time ?? '' };
  };

  const selectedCount = filtered.filter((r) => selectedKeys.has(rowKey(r))).length;

  return (
    <section className="section">
      <div className="section-header">
        <h2>5. 수집 결과</h2>
        <div className="btn-group">
          <span className="count-badge">총 {filtered.length}건</span>
          <button className="btn btn-primary" onClick={handleDownload}>엑셀 다운로드</button>
        </div>
      </div>

      <div className="filter-bar">
        <select value={filterExam} onChange={(e) => { setFilterExam(e.target.value); setCurrentPage(1); }}>
          <option value="">전체 시험</option>
          {exams.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filterStage} onChange={(e) => { setFilterStage(e.target.value); setCurrentPage(1); }}>
          <option value="">전체 단계</option>
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setCurrentPage(1); }}>
          <option value="">전체 유형</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
          <option value="">전체 수집 상태</option>
          <option value="수집 성공">수집 성공</option>
          <option value="수집 실패">수집 실패</option>
        </select>
        <select value={filterVerdict} onChange={(e) => { setFilterVerdict(e.target.value); setCurrentPage(1); }}>
          <option value="">전체 판정</option>
          <option value="통과">통과</option>
          <option value="수정 필요">수정 필요</option>
          <option value="재검수 필요">재검수 필요</option>
          <option value="미판정">미판정</option>
        </select>
        <div className="filter-bar-actions">
          {onRunVerdict && (
            <button
              className="btn btn-sm btn-verdict"
              onClick={() => onRunVerdict(selectedKeys)}
              disabled={verdictRunning || selectedCount === 0}
              title={selectedCount === 0 ? '행을 선택한 후 판정을 실행하세요' : `선택한 ${selectedCount}건 판정`}
            >
              {verdictRunning ? '판정 중…' : `선택 판정 실행 ${selectedCount > 0 ? `(${selectedCount}건)` : ''}`}
            </button>
          )}
          {onRunVerdict && (
            <button
              className="btn btn-sm btn-verdict-all"
              onClick={() => onRunVerdict(new Set())}
              disabled={verdictRunning || allResults.length === 0}
            >
              {verdictRunning ? '판정 중…' : '전체 판정 실행'}
            </button>
          )}
          <button
            className="btn btn-sm btn-danger"
            onClick={handleDeleteSelected}
            disabled={selectedCount === 0}
          >
            선택 삭제 {selectedCount > 0 && `(${selectedCount}건)`}
          </button>
          <button
            className="btn btn-sm btn-danger-outline"
            onClick={handleDeleteAll}
            disabled={allResults.length === 0}
          >
            전체 삭제
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  ref={masterCheckRef}
                  checked={allPageSelected}
                  onChange={() => {
                    updateKeys((prev) => {
                      const next = new Set(prev);
                      if (allPageSelected) {
                        paginated.forEach((r) => next.delete(rowKey(r)));
                      } else {
                        paginated.forEach((r) => next.add(rowKey(r)));
                      }
                      return next;
                    });
                  }}
                  title={allPageSelected ? '이 페이지 해제' : '이 페이지 선택'}
                />
              </th>
              <th>실행 시각</th>
              <th>시험 회차</th>
              <th>공개 단계</th>
              <th>질의 유형</th>
              <th>질의</th>
              <th>답변 본문</th>
              <th>링크</th>
              <th>수집 상태</th>
              <th>판정</th>
              <th>실패 사유</th>
              <th>소요(초)</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => {
              const key = rowKey(r);
              const links = parseLinks(r.source_links);
              const isSelected = selectedKeys.has(key);
              return (
                <tr key={key + i} className={`${r.collection_status === '수집 실패' ? 'row-fail' : ''} ${isSelected ? 'row-selected' : ''}`}>
                  <td>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(key)} />
                  </td>
                  <td className="cell-datetime">
                    {(() => { const { date, time } = formatDatetime(r.executed_at); return <><span className="datetime-date">{date}</span><span className="datetime-time">{time}</span></>; })()}
                  </td>
                  <td className="cell-exam">{r.exam_name}</td>
                  <td className="cell-stage">{r.stage_name}</td>
                  <td className="cell-type">{r.category}</td>
                  <td className="cell-query">{r.query_text}</td>
                  <td className="cell-body-wide">
                    {r.answer_text ? <ExpandableText text={r.answer_text} /> : '—'}
                  </td>
                  <td className="cell-links">
                    {links.map((l, j) => (
                      <a key={j} href={l.href} target="_blank" rel="noreferrer" className="link-barogage">
                        바로가기{links.length > 1 ? ` ${j + 1}` : ''}
                      </a>
                    ))}
                  </td>
                  <td>
                    <span className={r.collection_status === '수집 성공' ? 'badge badge-success' : 'badge badge-fail'}>
                      {r.collection_status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${VERDICT_BADGE[verdictStatus(r)] || 'badge-verdict-none'}`}>
                      {verdictStatus(r)}
                    </span>
                  </td>
                  <td className="cell-error">{r.error_message}</td>
                  <td className="cell-elapsed">{r.elapsed_seconds}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteOne(r)}>삭제</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={13} className="no-data">수집 결과가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>이전</button>
          <span className="pagination-info">{currentPage} / {totalPages} 페이지 (총 {filtered.length}건)</span>
          <button className="btn btn-sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>다음</button>
        </div>
      )}
    </section>
  );
}
