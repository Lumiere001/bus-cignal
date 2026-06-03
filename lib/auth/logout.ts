"use server";

import { redirect } from "next/navigation";
import { clearMasterSession } from "./master";
import { clearOperatorSession } from "./operator";
import { clearPassengerSession } from "./passenger";

/**
 * 로그아웃 서버 액션 (마스터·간사·학생). 세션 쿠키 삭제 후 각 진입점으로 redirect.
 *
 * 로그인은 우리가 발급(sign·issue 함수)하므로 로그아웃 액션도 auth 인프라(팀장/CC)에서 제공.
 * 페이지에서는 버튼만 연결:
 *   <form action={logoutOperator}><button type="submit">로그아웃</button></form>
 * (admin/login 의 login 폼과 동일 패턴). 버튼 배치·문구는 각 페이지 담당.
 */

/** 마스터 로그아웃 → /admin/login */
export async function logoutMaster() {
  await clearMasterSession();
  redirect("/admin/login");
}

/** 간사 로그아웃 → /login */
export async function logoutOperator() {
  await clearOperatorSession();
  redirect("/login");
}

/** 학생 로그아웃 → / (랜딩) */
export async function logoutPassenger() {
  await clearPassengerSession();
  redirect("/");
}
