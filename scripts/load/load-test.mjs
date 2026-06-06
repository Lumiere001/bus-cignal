import { chromium } from "@playwright/test";
import { arg } from "./_env.mjs";

// 로컬 부하 테스트 — 세션 쿠키(학생/간사/마스터) 확보 후 동시 fetch로 읽기 혼합 부하.
//   node scripts/load/load-test.mjs --url http://localhost:3100 --vus 100 --duration 20
// ⚠️ 정확한 수치는 dev가 아니라 prod 빌드에 대고 측정: pnpm build && pnpm start (런북 참고).

const URL = (arg("url", "http://localhost:3100") + "").replace(/\/$/, "");
const VUS = Number(arg("vus", 100));
const DURATION = Number(arg("duration", 20)) * 1000;
const CODE = arg("code", "BUS-7K9M");
const NAME = arg("name", "이지은");
const LAST4 = arg("last4", "4444");

function cookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function sessions() {
  const b = await chromium.launch();
  const out = {};
  // 학생: /r 본인확인
  const sc = await b.newContext();
  const sp = await sc.newPage();
  await sp.goto(`${URL}/r/${CODE}`);
  await sp.fill("#name", NAME); await sp.fill("#phoneLast4", LAST4);
  await sp.getByRole("button", { name: "본인 확인" }).click();
  await sp.waitForURL(/\/me$/, { timeout: 15000 }).catch(() => {});
  out.passenger = cookieHeader(await sc.cookies());
  // 간사·마스터: dev-login
  for (const [role, name, url] of [["operator", /김광주/, /\/operator/], ["master", /마스터로 로그인/, /\/admin$/]]) {
    const c = await b.newContext();
    const p = await c.newPage();
    await p.goto(`${URL}/dev/login`);
    await p.getByRole("button", { name }).click();
    await p.waitForURL(url, { timeout: 15000 }).catch(() => {});
    out[role] = cookieHeader(await c.cookies());
  }
  await b.close();
  return out;
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

async function main() {
  console.log(`🎯 ${URL} · VUs=${VUS} · ${DURATION / 1000}s`);
  console.log("세션 확보 중…");
  const s = await sessions();
  console.log(`  학생=${s.passenger ? "OK" : "실패"} 간사=${s.operator ? "OK" : "실패"} 마스터=${s.master ? "OK" : "실패"}`);

  const mix = [
    { path: "/me", cookie: s.passenger, w: 40 },
    { path: "/", cookie: "", w: 20 },
    { path: `/r/${CODE}`, cookie: "", w: 15 },
    { path: "/operator", cookie: s.operator, w: 15 },
    { path: "/admin", cookie: s.master, w: 10 },
  ];
  const bag = [];
  mix.forEach((m, i) => { for (let k = 0; k < m.w; k++) bag.push(i); });
  const stats = mix.map(() => ({ ms: [], ok: 0, err: 0 }));

  const end = Date.now() + DURATION;
  async function worker() {
    while (Date.now() < end) {
      const idx = bag[Math.floor(Math.random() * bag.length)];
      const m = mix[idx];
      const t = Date.now();
      try {
        const r = await fetch(`${URL}${m.path}`, { headers: m.cookie ? { cookie: m.cookie } : {}, redirect: "manual" });
        stats[idx].ms.push(Date.now() - t);
        (r.status < 400 || r.status === 303 || r.status === 307 ? stats[idx].ok++ : stats[idx].err++);
      } catch {
        stats[idx].err++;
      }
    }
  }
  const t0 = Date.now();
  await Promise.all(Array.from({ length: VUS }, worker));
  const secs = (Date.now() - t0) / 1000;

  let total = 0, errs = 0;
  console.log("\n엔드포인트            요청   에러   p50    p95    p99   (ms)");
  for (let i = 0; i < mix.length; i++) {
    const st = stats[i], n = st.ok + st.err; total += n; errs += st.err;
    console.log(
      `${mix[i].path.padEnd(20)} ${String(n).padStart(6)} ${String(st.err).padStart(6)}  ${String(pct(st.ms, 50)).padStart(5)} ${String(pct(st.ms, 95)).padStart(6)} ${String(pct(st.ms, 99)).padStart(6)}`,
    );
  }
  console.log(`\n총 ${total} 요청 · ${(total / secs).toFixed(0)} req/s · 에러율 ${((errs / total) * 100).toFixed(2)}%`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
