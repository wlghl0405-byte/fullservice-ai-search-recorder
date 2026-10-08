import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import ExamSelector from '../components/ExamSelector';
import TimelineEditor from '../components/TimelineEditor';
import QuerySetManager from '../components/QuerySetManager';
import SearchRunner from '../components/SearchRunner';
import ResultTable from '../components/ResultTable';
import VerdictPanel, { VerdictPanelHandle } from '../components/VerdictPanel';
import { Exam, TestQuery, SearchResult, ExecutionLog, VerdictResult } from '../lib/types';

export default function Home() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [selectedStage, setSelectedStage] = useState('');
  const [queries, setQueries] = useState<TestQuery[]>([]);
  const [selectedQueryIds, setSelectedQueryIds] = useState<Set<string>>(new Set());
  const [newResults, setNewResults] = useState<SearchResult[]>([]);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [verdictUpdates, setVerdictUpdates] = useState<
    Array<{ run_id: string; query_id: string; verdict: VerdictResult }>
  >([]);
  const [selectedResultKeys, setSelectedResultKeys] = useState<Set<string>>(new Set());
  const [verdictRunning, setVerdictRunning] = useState(false);

  const verdictPanelRef = useRef<VerdictPanelHandle>(null);

  useEffect(() => {
    fetch('/api/exams').then((r) => r.json()).then((d) => {
      setExams(d.exams || []);
      if (d.exams?.length > 0 && !selectedExam) {
        setSelectedExam(d.exams[0]);
      }
    });
    fetch('/api/save-queries').then((r) => r.json()).then((d) => {
      setQueries(d.queries || []);
    });
  }, []);

  useEffect(() => {
    fetch('/api/results').then((r) => r.json()).then((d) => setAllResults(d.results || []));
  }, []);

  const handleComplete = (results: SearchResult[], _logs: ExecutionLog[]) => {
    setNewResults(results);
    setAllResults((prev) => {
      const ids = new Set(results.map((r) => `${r.run_id}|${r.query_id}`));
      return [...results, ...prev.filter((r) => !ids.has(`${r.run_id}|${r.query_id}`))];
    });
  };

  const handleVerdictDelete = (updatedResults: SearchResult[]) => {
    setAllResults(updatedResults);
    setNewResults([]);
  };

  const handleVerdictComplete = (
    updates: Array<{ run_id: string; query_id: string; verdict: VerdictResult }>,
  ) => {
    setVerdictUpdates(updates);
    setAllResults((prev) =>
      prev.map((r) => {
        const u = updates.find((up) => up.run_id === r.run_id && up.query_id === r.query_id);
        return u ? { ...r, verdict: u.verdict } : r;
      }),
    );
  };

  const handleRunVerdict = useCallback((keys: Set<string>) => {
    if (keys.size === 0) {
      // 빈 Set = 전체 판정
      verdictPanelRef.current?.runVerdictForKeys(new Set(['__all__']));
    } else {
      verdictPanelRef.current?.runVerdictForKeys(keys);
    }
  }, []);

  return (
    <>
      <Head>
        <title>풀서비스 검수 자동화 도구</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="app">
        <header className="app-header">
          <h1>풀서비스 검수 자동화 도구</h1>
        </header>

        <main className="app-main">
          <ExamSelector
            exams={exams}
            selectedExamId={selectedExam?.exam_id || ''}
            onSelect={(exam) => {
              setSelectedExam(exam);
              setSelectedStage('');
            }}
            onExamsChange={setExams}
          />

          {selectedExam && (
            <TimelineEditor
              examId={selectedExam.exam_id}
              examName={selectedExam.exam_name}
              selectedStage={selectedStage}
              onStageSelect={setSelectedStage}
            />
          )}

          {selectedExam && (
            <QuerySetManager
              queries={queries}
              exams={exams}
              examId={selectedExam.exam_id}
              selectedStage={selectedStage}
              selectedQueryIds={selectedQueryIds}
              onQueriesChange={setQueries}
              onSelectionChange={setSelectedQueryIds}
            />
          )}

          {selectedExam && (
            <SearchRunner
              examId={selectedExam.exam_id}
              examName={selectedExam.exam_name}
              selectedStage={selectedStage}
              allQueries={queries}
              selectedQueryIds={selectedQueryIds}
              onComplete={handleComplete}
            />
          )}

          <ResultTable
            newResults={newResults}
            parentResults={allResults}
            selectedExamName={selectedExam?.exam_name}
            verdictUpdates={verdictUpdates}
            onSelectionChange={setSelectedResultKeys}
            onRunVerdict={handleRunVerdict}
            verdictRunning={verdictRunning}
          />

          <VerdictPanel
            ref={verdictPanelRef}
            allResults={allResults}
            selectedExamName={selectedExam?.exam_name}
            selectedKeys={selectedResultKeys}
            onVerdictComplete={handleVerdictComplete}
            onVerdictDelete={handleVerdictDelete}
            onRunningChange={setVerdictRunning}
          />
        </main>

        <footer className="app-footer" />
      </div>
    </>
  );
}
