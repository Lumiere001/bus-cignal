-- 출발 리마인더 — 매칭별 1회 발송 보장용 플래그.
-- depart-reminder cron(외부 GitHub Actions 스케줄러)이 출발 24h 이내·미발송 paid 매칭에
-- depart_d1 알림을 보낸 뒤 이 컬럼을 채워 중복 발송을 막는다.
alter table matches add column depart_reminded_at timestamptz;
