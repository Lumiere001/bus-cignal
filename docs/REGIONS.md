---
agent: claude-code
status: finalized
created: 2026-05-26T21:00:00+09:00
last_modified: 2026-05-26T21:00:00+09:00
awaiting_approval: false
priority: normal
tags: [bus-cignal, data, regions, seed]
---

# Bus Cignal — 전국 지구 데이터

> CCC 전국 지구 마스터 데이터. seed import용 CSV는 `data/regions.csv`.
> 총 **52개 지구** (특수 부서 3 + 일반 지구 48 + 해외 1).

---

## 권역별 요약

| 권역 | 지구 수 | 지구 |
|---|---|---|
| 서울 | 10 | 서울동1·동2·서·서2·남·북·북동·북동2·중앙·북중앙 |
| 인천 | 1 | 인천 |
| 경기 | 9 | 수원·안양·용인·성남·안산·평택안성·부천·의정부·경기P2C |
| 강원 | 4 | 강릉속초·춘천·원주·삼척 |
| 대전 | 1 | 대전 |
| 충남 | 3 | 공주·천안·홍성 |
| 세종 | 1 | 세종 |
| 충북 | 3 | 청주·충주·제천 |
| 광주 | 1 | 광주 |
| 전남 | 2 | 목포·순천여수 |
| 제주 | 1 | 제주 |
| 전북 | 3 | 전주·군산·익산 |
| 부산 | 1 | 부산 |
| 울산 | 1 | 울산 |
| 경남 | 2 | 창원·진주 |
| 대구 | 1 | 대구 |
| 경북 | 5 | 안동·경주·포항·김천구미·영주 |
| 특수 | 3 | 외국인사역부 B.I.·의료선교부·TIA |
| 해외 | 1 | 해외 |
| **합계** | **52** | |

---

## 전체 지구 (지구번호 순)

| 지구번호 | 지구명 | 권역 | 분류 |
|---|---|---|---|
| 1408 | 외국인사역부 B.I. | 특수 | special_ministry |
| 1704 | 의료선교부 | 특수 | special_ministry |
| 1705 | TIA | 특수 | special_ministry |
| 2101 | 서울동1 | 서울 | regular |
| 2102 | 서울동2 | 서울 | regular |
| 2103 | 서울서 | 서울 | regular |
| 2104 | 서울서2 | 서울 | regular |
| 2105 | 서울남 | 서울 | regular |
| 2106 | 서울북 | 서울 | regular |
| 2107 | 서울북동 | 서울 | regular |
| 2108 | 서울북동2 | 서울 | regular |
| 2109 | 서울중앙 | 서울 | regular |
| 2110 | 서울북중앙 | 서울 | regular |
| 2201 | 인천지구 | 인천 | regular |
| 2202 | 수원지구 | 경기 | regular |
| 2203 | 안양지구 | 경기 | regular |
| 2204 | 용인지구 | 경기 | regular |
| 2205 | 성남지구 | 경기 | regular |
| 2206 | 안산지구 | 경기 | regular |
| 2207 | 평택안성 | 경기 | regular |
| 2208 | 부천지구 | 경기 | regular |
| 2209 | 의정부지구 | 경기 | regular |
| 2301 | 강릉속초 | 강원 | regular |
| 2302 | 춘천지구 | 강원 | regular |
| 2303 | 원주지구 | 강원 | regular |
| 2304 | 삼척지구 | 강원 | regular |
| 2401 | 대전지구 | 대전 | regular |
| 2402 | 공주지구 | 충남 | regular |
| 2403 | 천안지구 | 충남 | regular |
| 2404 | 세종지구 | 세종 | regular |
| 2405 | 홍성지구 | 충남 | regular |
| 2501 | 청주지구 | 충북 | regular |
| 2502 | 충주지구 | 충북 | regular |
| 2503 | 제천지구 | 충북 | regular |
| 2601 | 광주지구 | 광주 | regular |
| 2603 | 목포지구 | 전남 | regular |
| 2605 | 제주지구 | 제주 | regular |
| 2606 | 순천여수 | 전남 | regular |
| 2701 | 전주지구 | 전북 | regular |
| 2702 | 군산지구 | 전북 | regular |
| 2703 | 익산지구 | 전북 | regular |
| 2801 | 부산지구 | 부산 | regular |
| 2802 | 창원지구 | 경남 | regular |
| 2803 | 울산지구 | 울산 | regular |
| 2804 | 진주지구 | 경남 | regular |
| 2901 | 대구지구 | 대구 | regular |
| 2902 | 안동지구 | 경북 | regular |
| 2903 | 경주지구 | 경북 | regular |
| 2904 | 포항지구 | 경북 | regular |
| 2905 | 김천구미 | 경북 | regular |
| 2906 | 영주지구 | 경북 | regular |
| 4701 | 경기P2C | 경기 | regular |
| 9999 | 해외 | 해외 | overseas |

---

## Bus Cignal 시스템에서의 활용

### Trip 등록 시 노선 조합
- 상행: 한 지구 → 평창
- 하행: 평창 → 한 지구
- **특수 부서** (1408·1704·1705)는 본인 지구 의 학교/거점이 흩어져 있어 노선이 다양할 수 있음 → Trip 등록 시 정확한 출발지 주소가 더 중요
- **해외 (9999)**는 운행 가능성 거의 없음. 단 한국 내 본가 있는 학생이 타지구 차량 이용 가능성은 있음

### 자주 발생할 매칭 패턴 (예측)
- 서울 ↔ 호남 (광주·전주·목포 등): 학교 서울 + 본가 호남 학생들
- 서울 ↔ 영남 (부산·대구 등): 동일
- 광주 ↔ 영남: 비교적 적음
- 수도권 내 (서울·경기·인천): 거리 가까워 자체 해결 비율 ↑

→ 매칭 가능한 페어 = 약 51 × 50 / 2 ≈ 1,275 페어 (이론). 실제는 거리·인원으로 한정.

### Seed Import 시 권장 순서
1. 특수 부서 먼저 (1408·1704·1705) — 운영 안정성 확인
2. 일반 지구 일괄 (2101~2906, 4701)
3. 해외 (9999) — 운영 필요 시점에만

### Region 모델 추가 필드 (Bus Cignal `regions` 테이블에)
v1.0 spec의 `regions` 테이블에 다음 컬럼 추가 권장:
```sql
ALTER TABLE regions ADD COLUMN code TEXT UNIQUE;        -- CCC 지구번호 (1408 등)
ALTER TABLE regions ADD COLUMN area TEXT;               -- 권역 (서울, 경기 등)
ALTER TABLE regions ADD COLUMN category TEXT            -- regular | special_ministry | overseas
  CHECK (category IN ('regular','special_ministry','overseas'));
```

---

## 변경 이력

| 일자 | 변경 | 비고 |
|---|---|---|
| 2026-05-26 | 초기 작성. 팀장가 CCC 지구 목록 제공, 52개 등록 | v1.0 확정 시점 |
