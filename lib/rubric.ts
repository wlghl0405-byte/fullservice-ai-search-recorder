export interface RubricRule {
  stage_order: number; // 0 = 전체(모든 단계 공통)
  stage_name: string;
  category: string;
  query_description: string;
  answer_standard: string;
  reference_phrase: string;
  inspection_point: string;
}

// 루브릭 규칙 데이터 (풀서비스 AI검색 답변 검수 루브릭_v1.0.xlsx 기반)
export const RUBRIC_RULES: RubricRule[] = [
  // ── 0. 전체 공통 ──────────────────────────────────────────────────────────
  {
    stage_order: 0, stage_name: '전체', category: '공통',
    query_description: '세부 구분값 없이 사용자 개인 성적/채점 결과를 묻는 질의',
    answer_standard: '사용자 데이터 기반 답변이 아니라 추가 정보 또는 서비스 이용 경로 안내',
    reference_phrase: '세부적인 구분값이 없는 사용자 개인화 질의는 답변 불가',
    inspection_point: '개인화 데이터가 없는 상태에서 성적·채점 결과를 확정적으로 답하지 않는지 확인',
  },
  {
    stage_order: 0, stage_name: '전체', category: '공통',
    query_description: '정답·배점·등급컷·문항 통계처럼 다수 항목을 제공하는 질의',
    answer_standard: '표 또는 구조화된 형식으로 제공',
    reference_phrase: '답변 출력 시 테이블 형식 사용',
    inspection_point: '목록형 데이터가 문장만으로 길게 나열되지 않는지 확인',
  },
  {
    stage_order: 0, stage_name: '전체', category: '공통',
    query_description: '등급컷, 정·오답률, 선택지 선택비율, 난이도 등 변동 데이터 질의',
    answer_standard: '산출 기준 시각 포함',
    reference_phrase: 'YYYY.MM.DD hh시 산출 기준입니다.',
    inspection_point: '변동 데이터 답변에 산출 기준 시각이 포함되는지 확인',
  },
  {
    stage_order: 0, stage_name: '전체', category: '공통',
    query_description: '정답, 배점, 해설강의 등 고정 데이터 질의',
    answer_standard: '불필요한 업데이트 기준 문구 없이 제공',
    reference_phrase: '고정 데이터 관련 답변 시 업데이트 기준 미포함',
    inspection_point: '고정 데이터에 산출 기준/업데이트 기준 문구가 불필요하게 붙지 않는지 확인',
  },
  {
    stage_order: 0, stage_name: '전체', category: '공통',
    query_description: '풀서비스 관련 답변 전체',
    answer_standard: '답변 하단에 해당 시험·학년 풀서비스 페이지 바로가기 제공',
    reference_phrase: '자세한 풀서비스 정보는 아래 바로가기를 통해 확인하실 수 있습니다. ▶ [{시험명} 풀서비스 페이지 바로가기]({URL})',
    inspection_point: '답변 하단에 풀서비스 바로가기 링크가 포함되는지 확인',
  },
  {
    stage_order: 0, stage_name: '전체', category: '등급컷',
    query_description: '영어·한국사 등 절대평가 과목의 등급컷 질의',
    answer_standard: '절대평가 과목은 등급컷이 별도 산출되지 않음을 안내',
    reference_phrase: '영어(또는 한국사)는 절대평가 과목으로 등급컷이 별도로 산출되지 않습니다.',
    inspection_point: '영어·한국사에 등급컷 숫자를 임의 제공하지 않는지 확인',
  },
  {
    stage_order: 0, stage_name: '전체', category: '등급컷',
    query_description: '검색 컨텍스트에 없는 시험의 등급컷 질의',
    answer_standard: '현재 제공 중인 시험의 등급컷 데이터만 안내',
    reference_phrase: '해당 시험의 등급컷 데이터는 현재 제공하고 있지 않습니다.',
    inspection_point: '다른 시험 데이터를 현재 시험 데이터처럼 답하지 않는지 확인',
  },
  {
    stage_order: 0, stage_name: '전체', category: '정답',
    query_description: '현재 풀서비스 대상이 아닌 시험의 정답 질의',
    answer_standard: '현재 제공 중인 학력평가 정답만 제공하고 있음을 안내',
    reference_phrase: '3월 학력평가 정답만 제공하고 있음을 안내',
    inspection_point: '다른 시험 정답을 현재 회차 기준으로 답하지 않는지 확인',
  },
  {
    stage_order: 0, stage_name: '전체', category: '배점',
    query_description: '현재 풀서비스 대상이 아닌 시험의 배점 질의',
    answer_standard: '현재 제공 중인 학력평가 배점만 제공하고 있음을 안내',
    reference_phrase: '3월 학력평가 배점만 제공하고 있음을 안내',
    inspection_point: '다른 시험 배점을 현재 회차 기준으로 답하지 않는지 확인',
  },

  // ── 1. 시험 종료 전 ──────────────────────────────────────────────────────
  {
    stage_order: 1, stage_name: '시험 종료 전', category: '정답',
    query_description: '정답 관련 질의 전체',
    answer_standard: '정답 제공 전 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '정답을 확정값으로 제공하지 않고 준비 중 안내가 나오는지 확인',
  },
  {
    stage_order: 1, stage_name: '시험 종료 전', category: '배점',
    query_description: '배점 관련 질의 전체',
    answer_standard: '배점 제공 전 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '배점을 확정값으로 제공하지 않고 준비 중 안내가 나오는지 확인',
  },
  {
    stage_order: 1, stage_name: '시험 종료 전', category: '등급컷',
    query_description: '등급컷 관련 질의 전체',
    answer_standard: '표본 집계 전 또는 데이터 미등록 안내',
    reference_phrase: '예상 등급컷 산출을 위해 현재 표본 집계 중입니다. 응시 결과 데이터가 충분히 집계된 후 등급컷을 확인하실 수 있습니다.',
    inspection_point: '등급컷 값을 제공하지 않고 표본 집계 안내가 나오는지 확인',
  },
  {
    stage_order: 1, stage_name: '시험 종료 전', category: '정오답률',
    query_description: '정·오답률 관련 질의 전체',
    answer_standard: '채점 서비스 오픈 이후 확인 가능 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '문항 통계를 제공하지 않고 준비 중 안내가 나오는지 확인',
  },
  {
    stage_order: 1, stage_name: '시험 종료 전', category: '난이도',
    query_description: '난이도 관련 질의 전체',
    answer_standard: '채점 서비스 오픈 이후 확인 가능 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '난이도를 제공하지 않고 준비 중 안내가 나오는지 확인',
  },
  {
    stage_order: 1, stage_name: '시험 종료 전', category: '선지별 선택비율',
    query_description: '선택비율 관련 질의 전체',
    answer_standard: '채점 서비스 오픈 이후 확인 가능 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '선택비율을 제공하지 않고 준비 중 안내가 나오는지 확인',
  },

  // ── 2. 시험 종료 ─────────────────────────────────────────────────────────
  {
    stage_order: 2, stage_name: '시험 종료', category: '정답',
    query_description: '정답 관련 질의 전체',
    answer_standard: '정답 제공 전 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '정답 공개 전 확정 답변이 나오지 않는지 확인',
  },
  {
    stage_order: 2, stage_name: '시험 종료', category: '배점',
    query_description: '배점 관련 질의 전체',
    answer_standard: '배점 제공 전 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '배점 공개 전 확정 답변이 나오지 않는지 확인',
  },

  // ── 3. 사전 채점 오픈 ────────────────────────────────────────────────────
  {
    stage_order: 3, stage_name: '사전 채점 오픈', category: '정답',
    query_description: '정답 관련 질의 전체',
    answer_standard: '정답 제공 전 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '사전 채점 단계에서 정답을 확정 제공하지 않는지 확인',
  },
  {
    stage_order: 3, stage_name: '사전 채점 오픈', category: '배점',
    query_description: '배점 관련 질의 전체',
    answer_standard: '배점 제공 전 안내',
    reference_phrase: '현재 답변을 준비 중입니다. 채점 서비스 오픈 이후 확인 가능합니다.',
    inspection_point: '사전 채점 단계에서 배점을 확정 제공하지 않는지 확인',
  },

  // ── 4. 정답 공개 ─────────────────────────────────────────────────────────
  {
    stage_order: 4, stage_name: '정답 공개', category: '정답',
    query_description: '시험명만 입력한 정답 질의',
    answer_standard: '학년, 과목명, 문항 번호 입력 요구',
    reference_phrase: '학년, 과목명, 문항 번호 입력 요구',
    inspection_point: '시험명만으로 전체 정답을 무조건 출력하지 않고 추가 입력을 요구하는지 확인',
  },
  {
    stage_order: 4, stage_name: '정답 공개', category: '정답',
    query_description: '과목명+문항 번호 입력',
    answer_standard: '해당 과목, 해당 문항 번호의 전 학년 정답 제공',
    reference_phrase: '해당 과목, 해당 문항 번호 전 학년(고1, 고2, 고3) 정답 출력',
    inspection_point: '과목+문항번호 기준으로 전 학년 정답을 제공하는지 확인',
  },
  {
    stage_order: 4, stage_name: '정답 공개', category: '정답',
    query_description: '학년+과목명 입력',
    answer_standard: '해당 학년, 해당 과목 정답 제공',
    reference_phrase: '해당 학년, 해당 과목 정답 출력',
    inspection_point: '학년+과목 기준으로 정답이 제공되는지 확인',
  },
  {
    stage_order: 4, stage_name: '정답 공개', category: '배점',
    query_description: '시험명만 입력한 배점 질의',
    answer_standard: '학년, 과목명, 문항 번호 입력 요구',
    reference_phrase: '학년, 과목명, 문항 번호 입력 요구',
    inspection_point: '시험명만으로 전체 배점을 무조건 출력하지 않고 추가 입력을 요구하는지 확인',
  },
  {
    stage_order: 4, stage_name: '정답 공개', category: '배점',
    query_description: '과목명+문항 번호 입력',
    answer_standard: '해당 과목, 해당 문항 번호의 전 학년 배점 제공',
    reference_phrase: '해당 과목, 해당 문항 번호 전 학년(고1, 고2, 고3) 배점 출력',
    inspection_point: '과목+문항번호 기준으로 전 학년 배점이 제공되는지 확인',
  },
  {
    stage_order: 4, stage_name: '정답 공개', category: '배점',
    query_description: '학년+과목명 입력',
    answer_standard: '해당 학년, 해당 과목 배점 제공',
    reference_phrase: '해당 학년, 해당 과목 배점 출력',
    inspection_point: '학년+과목 기준으로 배점이 제공되는지 확인',
  },
  {
    stage_order: 4, stage_name: '정답 공개', category: '등급컷',
    query_description: '등급컷 관련 질의 전체',
    answer_standard: '표본 집계 안내',
    reference_phrase: '예상 등급컷 산출을 위해 현재 표본 집계 중입니다. 응시 결과 데이터가 충분히 집계된 후 등급컷을 확인하실 수 있습니다.',
    inspection_point: '등급컷 공개 전 수치 제공 없이 표본 집계 안내가 나오는지 확인',
  },

  // ── 5. 채점 서비스 오픈 ──────────────────────────────────────────────────
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '등급컷',
    query_description: '개인화 등급컷 질의',
    answer_standard: '학년, 과목명, 성적 입력 요구',
    reference_phrase: '학년, 과목명, 성적 입력 요구',
    inspection_point: '사용자 개인 등급컷을 직접 추정하지 않고 필요한 입력값을 요구하는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '등급컷',
    query_description: '학년만 입력한 등급컷 질의',
    answer_standard: '과목명 입력 요구',
    reference_phrase: '과목명 입력 요구',
    inspection_point: '학년만으로 등급컷을 출력하지 않고 과목 입력을 요구하는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '등급컷',
    query_description: '학년 없이 전 과목만 입력',
    answer_standard: '학년 입력 요구',
    reference_phrase: '학년 입력 요구',
    inspection_point: '전 과목 질의에서 학년 누락 시 학년 입력을 요구하는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '등급컷',
    query_description: '국어·수학 등급컷 질의',
    answer_standard: '표본 집계 안내 (국어/수학 1차 등급컷 오픈 전)',
    reference_phrase: '예상 등급컷 산출을 위해 현재 표본 집계 중입니다. 응시 결과 데이터가 충분히 집계된 후 등급컷을 확인하실 수 있습니다.',
    inspection_point: '국어/수학 1차 등급컷 오픈 전 표본 집계 안내가 나오는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '등급컷',
    query_description: '사회탐구·과학탐구 등급컷 질의',
    answer_standard: '표본 집계 안내 (사탐/과탐 1차 등급컷 오픈 전)',
    reference_phrase: '예상 등급컷 산출을 위해 현재 표본 집계 중입니다. 응시 결과 데이터가 충분히 집계된 후 등급컷을 확인하실 수 있습니다.',
    inspection_point: '사탐/과탐 1차 등급컷 오픈 전 표본 집계 안내가 나오는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '등급컷',
    query_description: '등급컷 제공 시점 문의',
    answer_standard: '현재 실시간 등급컷 제공 중임 안내 또는 학년/과목/성적 입력 요구',
    reference_phrase: '현재 실시간 등급컷을 제공 중임을 안내 & 학년, 과목, 성적 입력 요구',
    inspection_point: '데이터 존재 여부에 따라 일정 문의 답변이 적절한지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '정오답률',
    query_description: '오답률/정답률 질의에 필수 입력 부족',
    answer_standard: '학년, 과목명, 문항 번호 입력 요구',
    reference_phrase: '학년, 과목명, 문항 번호 입력 요구',
    inspection_point: '필수 입력값이 부족할 때 문항 통계를 임의 출력하지 않는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '정오답률',
    query_description: '과목명+어려운/쉬운/오답률 높은 문항 문의',
    answer_standard: '전 학년 해당 과목의 정답률 낮은/높은 순서 TOP3 문항과 난이도 제공',
    reference_phrase: '전 학년 해당 과목의 정답률 낮은/높은 순서 TOP3 문항과 난이도 출력',
    inspection_point: '문항 개수 미지정 시 TOP3 중심으로 제공되는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '정오답률',
    query_description: '과목명+문항 번호+오답률/정답률 문의',
    answer_standard: '전 학년 해당 과목, 해당 문항 번호의 정답률/오답률 제공',
    reference_phrase: '전 학년 해당 과목, 해당 문항 번호의 정답률 출력',
    inspection_point: '특정 문항 기준으로 통계가 제공되는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '선지별 선택비율',
    query_description: '과목명+문항 번호+선택비율 문의',
    answer_standard: '전 학년 해당 과목의 해당 문항 번호 선택비율 제공',
    reference_phrase: '전 학년 해당 과목의 해당 문항 번호 선택비율 출력',
    inspection_point: '선지별 선택비율이 표 형태로 제공되는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '난이도',
    query_description: '과목명만 입력하고 난이도 문의',
    answer_standard: '과목 총평 참고 안내',
    reference_phrase: '%과목명% 난이도는 %과목명% 총평을 참고해주세요.',
    inspection_point: '과목 전체 난이도를 문항별 난이도로 오해하지 않는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '난이도',
    query_description: '과목명+문항 번호+난이도 문의',
    answer_standard: '해당 문항 난이도 제공',
    reference_phrase: '해당 문항의 난이도 정보 제공',
    inspection_point: '문항번호 포함 시 해당 문항 난이도가 제공되는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '난이도',
    query_description: '난이도 질의에 필수 입력 부족',
    answer_standard: '학년, 과목명, 문항 번호 입력 요구',
    reference_phrase: '학년, 과목명, 문항 번호 입력 요구',
    inspection_point: '필수 입력값이 부족할 때 난이도를 임의 출력하지 않는지 확인',
  },
  {
    stage_order: 5, stage_name: '채점 서비스 오픈', category: '정오답률',
    query_description: '판단 기준이 명확하지 않은 자연어 질의',
    answer_standard: '임의 해석하지 않고 기준 구체화 요구',
    reference_phrase: '판단 기준이 명확하지 않은 표현은 임의 해석하지 않습니다.',
    inspection_point: '모호한 질의를 오답률/선택비율 등으로 임의 변환하지 않는지 확인',
  },

  // ── 6. 국어, 수학 1차 등급컷 오픈 ────────────────────────────────────────
  {
    stage_order: 6, stage_name: '국어, 수학 1차 등급컷 오픈', category: '등급컷',
    query_description: '학년+국어/수학 과목명 입력',
    answer_standard: '해당 과목, 해당 학년 전체 등급컷 제공 (선택과목 포함)',
    reference_phrase: '해당 과목, 해당 학년 전체 등급컷 출력(선택과목 포함)',
    inspection_point: '국어/수학 등급컷이 제공되고 선택과목이 포함되는지 확인',
  },
  {
    stage_order: 6, stage_name: '국어, 수학 1차 등급컷 오픈', category: '등급컷',
    query_description: '국어/수학 과목명+성적 입력',
    answer_standard: '해당 과목 전 학년 등급컷과 점수 해당 등급 제공',
    reference_phrase: '해당 과목 전 학년(고1, 고2, 고3) 등급컷 출력',
    inspection_point: '점수 기반 등급 판정이 등급컷 하한 기준으로 제공되는지 확인',
  },
  {
    stage_order: 6, stage_name: '국어, 수학 1차 등급컷 오픈', category: '등급컷',
    query_description: '학년+과목명+등급 입력',
    answer_standard: '해당 학년·과목의 해당 등급 원점수 범위 제공',
    reference_phrase: '해당 학년·과목의 해당 등급 원점수 범위 출력',
    inspection_point: '등급 입력 시 해당 등급 점수 범위가 제공되는지 확인',
  },
  {
    stage_order: 6, stage_name: '국어, 수학 1차 등급컷 오픈', category: '등급컷',
    query_description: '사회탐구·과학탐구 등급컷 질의',
    answer_standard: '표본 집계 안내 (사탐/과탐은 아직 미오픈)',
    reference_phrase: '예상 등급컷 산출을 위해 현재 표본 집계 중입니다. 응시 결과 데이터가 충분히 집계된 후 등급컷을 확인하실 수 있습니다.',
    inspection_point: '사탐/과탐 등급컷 오픈 전 표본 집계 안내가 유지되는지 확인',
  },

  // ── 7. 사탐, 과탐 1차 등급컷 오픈 ────────────────────────────────────────
  {
    stage_order: 7, stage_name: '사탐, 과탐 1차 등급컷 오픈', category: '등급컷',
    query_description: '학년+사탐/과탐 과목명 입력',
    answer_standard: '해당 과목, 해당 학년 전체 등급컷 제공',
    reference_phrase: '해당 과목, 해당 학년 전체 등급컷 출력',
    inspection_point: '사탐/과탐 등급컷이 제공되는지 확인',
  },
  {
    stage_order: 7, stage_name: '사탐, 과탐 1차 등급컷 오픈', category: '등급컷',
    query_description: '전 학년+전 과목 입력',
    answer_standard: '전 학년 전 과목 등급컷 제공',
    reference_phrase: '해당 과목, 해당 학년 전체 등급컷 출력(선택과목 포함)',
    inspection_point: '전 학년/전 과목 질의가 학년별·과목별로 구조화되는지 확인',
  },

  // ── 8. 메가스터디 자체 등급컷 확정 ──────────────────────────────────────
  {
    stage_order: 8, stage_name: '메가스터디 자체 등급컷 확정', category: '등급컷',
    query_description: '등급컷 관련 질의 전체',
    answer_standard: '메가스터디 기준 확정 등급컷 의미 포함. 원점수 기준 안내',
    reference_phrase: '메가스터디 기준 확정 등급컷',
    inspection_point: '확정 단계에서 예측/실시간 표현이 남아 있지 않고 확정 의미가 포함되는지 확인',
  },
];

// stage_name 정규화: "/" → "," 차이 등 처리
function normalizeStageName(name: string): string {
  return name.replace(/\//g, ', ').trim();
}

export function getRulesForStageAndCategory(stageName: string, category: string): RubricRule[] {
  const normalizedStage = normalizeStageName(stageName);
  return RUBRIC_RULES.filter((rule) => {
    const ruleStage = normalizeStageName(rule.stage_name);
    const stageMatch = rule.stage_order === 0 || ruleStage === normalizedStage;
    const catMatch =
      rule.category === category ||
      rule.category === '공통' ||
      (category === '정오답률' && rule.category === '정오답률') ||
      (category === '선지별 선택비율' && rule.category === '선지별 선택비율');
    return stageMatch && catMatch;
  });
}
