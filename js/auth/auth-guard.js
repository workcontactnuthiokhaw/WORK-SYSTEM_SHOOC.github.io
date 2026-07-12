/**
 * auth-guard.js
 * ตรวจสอบ session และสิทธิ์ (role) ก่อนอนุญาตให้เข้าหน้าใดๆ หลัง login
 *
 * วิธีใช้: import ไฟล์นี้ไว้บนสุดของทุกหน้าใน /pages/** และ dashboard.html
 *   import { requireAuth } from '/js/auth/auth-guard.js';
 *   const profile = await requireAuth(['admin']); // อนุญาตเฉพาะ admin เท่านั้น
 *   const profile = await requireAuth(['admin','teacher']); // อนุญาตหลาย role
 *   const profile = await requireAuth(); // แค่เช็คว่า login แล้ว ไม่จำกัด role
 */

import supabaseClient from '../config/supabase-client.js';

const ROLE_HOME = {
  admin: '/pages/reports/dashboard-report.html',
  teacher: '/pages/teacher/activities.html',
  student: '/pages/student/activities-list.html',
};

const PROFILE_CACHE_KEY = 'sams_current_profile';

function redirectToLogin() {
  window.location.href = '/index.html';
}

/** ถอด payload ของ JWT (base64url) ออกมาดู โดยไม่ต้องยิง network request ไปถาม server */
function decodeJwtPayload(token) {
  try {
    const payloadPart = token.split('.')[1];
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** เช็คว่า token หมดอายุหรือยัง จาก exp claim ในตัว JWT เอง (เร็วกว่าถามฝั่ง server มาก) */
function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  const expiresAtMs = payload.exp * 1000;
  return Date.now() >= expiresAtMs;
}

function getCachedProfile() {
  const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * ตรวจสอบว่า login อยู่หรือไม่ และมี role ตรงตามที่กำหนดหรือไม่
 * ถ้าไม่ผ่านเงื่อนไข จะ redirect ออกไปหน้าที่เหมาะสมโดยอัตโนมัติ
 * คืนค่า profile ของผู้ใช้ปัจจุบัน { id, full_name, role } เมื่อผ่านการตรวจสอบ
 *
 * เพื่อความเร็ว (เว็บนี้เป็น multi-page เต็มหน้าใหม่ทุกครั้งที่เปลี่ยนเมนู):
 *   - เช็คว่า token หมดอายุหรือยังจาก exp claim ในตัว JWT เอง แทนการยิง network ไปถาม server ทุกครั้ง
 *   - ใช้ profile ที่ cache ไว้ใน sessionStorage จากการโหลดหน้าแรกในเซสชันนี้ แทนการ query
 *     ตาราง profiles ซ้ำทุกครั้งที่เปลี่ยนหน้า (ข้อมูลจริงยังถูกป้องกันด้วย RLS อยู่ดี
 *     การ cache นี้แค่ลดจำนวนรอบ network สำหรับ "เช็คสิทธิ์เพื่อ redirect" เท่านั้น)
 */
export async function requireAuth(allowedRoles = null) {
  const session = supabaseClient.auth.getSession();
  if (!session?.access_token) {
    redirectToLogin();
    return null;
  }

  if (isTokenExpired(session.access_token)) {
    redirectToLogin();
    return null;
  }

  const userId = decodeJwtPayload(session.access_token)?.sub;
  if (!userId) {
    redirectToLogin();
    return null;
  }

  // มี cache จากหน้าก่อนหน้าแล้ว -> ใช้ได้ก็ต่อเมื่อเป็น "คนเดียวกันกับ token ปัจจุบัน" เท่านั้น
  // (ป้องกันบั๊ก: สลับบัญชี login ในแท็บเดิม/เบราว์เซอร์เดิม แล้ว cache เก่าของคนก่อนหน้าค้างอยู่
  // ทำให้เห็นข้อมูลผิดคน แม้ token จะเปลี่ยนเป็นบัญชีใหม่แล้วก็ตาม)
  const cachedProfile = getCachedProfile();
  if (cachedProfile && cachedProfile.id === userId) {
    if (allowedRoles && !allowedRoles.includes(cachedProfile.role)) {
      window.location.href = ROLE_HOME[cachedProfile.role] || '/index.html';
      return null;
    }
    return cachedProfile;
  }

  // ไม่มี cache หรือ cache เป็นคนละบัญชีกับ token ปัจจุบัน -> ต้อง query ใหม่เสมอ
  const { data: profileRows, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id,full_name,role', { filters: [['id', 'eq', userId]] });

  if (profileError || !profileRows || profileRows.length === 0) {
    redirectToLogin();
    return null;
  }

  const profile = profileRows[0];

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    // login อยู่ แต่ role ไม่มีสิทธิ์เข้าหน้านี้ -> พาไปหน้า dashboard ของ role ตัวเอง
    window.location.href = ROLE_HOME[profile.role] || '/index.html';
    return null;
  }

  // เก็บ profile ไว้ใช้ต่อในเซสชันนี้ (หน้าถัดๆ ไปจะไม่ query ซ้ำ) + ใช้แสดงชื่อ/role ที่ topbar
  sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));

  return profile;
}

/** ใช้ตอน redirect หลัง login สำเร็จ ไปหน้า dashboard ที่ตรงกับ role */
export function getHomeForRole(role) {
  return ROLE_HOME[role] || '/index.html';
}