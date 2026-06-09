import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  STUDENT_COOKIE,
  STUDENT_SESSION_DAYS,
  signStudentToken,
  verifyStudentToken,
  type StudentClaims,
} from "./student-session";

/** 현재 학생 세션 (없으면 null). */
export async function getStudentSession(): Promise<StudentClaims | null> {
  const c = await cookies();
  return verifyStudentToken(c.get(STUDENT_COOKIE)?.value);
}

/** 학생 세션 필수 — 없으면 학생 로그인으로 redirect. */
export async function requireStudent(): Promise<StudentClaims> {
  const session = await getStudentSession();
  if (!session) redirect("/s/login");
  return session;
}

/** 학생 세션 쿠키 발급 (CCC 로그인 검증 후). */
export async function issueStudentSession(claims: StudentClaims) {
  const token = await signStudentToken(claims);
  const c = await cookies();
  c.set(STUDENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STUDENT_SESSION_DAYS * 24 * 60 * 60,
  });
}

/** 학생 세션 해제(로그아웃). */
export async function clearStudentSession() {
  const c = await cookies();
  c.delete(STUDENT_COOKIE);
}
