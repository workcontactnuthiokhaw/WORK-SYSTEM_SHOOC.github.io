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

function redirectToLogin() {
  window.location.href = '/index.html';
}

/**
 * ตรวจสอบว่า login อยู่หรือไม่ และมี role ตรงตามที่กำหนดหรือไม่
 * ถ้าไม่ผ่านเงื่อนไข จะ redirect ออกไปหน้าที่เหมาะสมโดยอัตโนมัติ
 * คืนค่า profile ของผู้ใช้ปัจจุบัน { id, full_name, role } เมื่อผ่านการตรวจสอบ
 */
export async function requireAuth(allowedRoles = null) {
  const session = supabaseClient.auth.getSession();
  if (!session) {
    redirectToLogin();
    return null;
  }

  // เช็คว่า token ยังใช้งานได้จริง (ไม่ได้ถูก revoke/หมดอายุ)
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData) {
    redirectToLogin();
    return null;
  }

  // ดึง role จากตาราง profiles
  const { data: profileRows, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id,full_name,role', { filters: [['id', 'eq', userData.id]] });

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

  // เก็บ profile ไว้ใช้ทั่วเว็บแบบเร็วๆ (sidebar, topbar แสดงชื่อ/role)
  sessionStorage.setItem('sams_current_profile', JSON.stringify(profile));

  return profile;
}

/** ใช้ตอน redirect หลัง login สำเร็จ ไปหน้า dashboard ที่ตรงกับ role */
export function getHomeForRole(role) {
  return ROLE_HOME[role] || '/index.html';
}