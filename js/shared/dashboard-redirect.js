/**
 * dashboard-redirect.js — หน้า "กำลังเข้าสู่ระบบ..." ที่ dashboard.html
 *
 * dashboard.html ไม่มีเนื้อหาของตัวเอง เป็นแค่หน้า "ทางผ่าน" (loading screen)
 * ที่ทำหน้าที่เช็ค session แล้วเด้งไปหน้า dashboard จริงตาม role ของผู้ใช้ทันที
 * เพื่อให้ index.html (login) และหน้าอื่นๆ redirect มาที่นี่ได้แบบไม่ต้องรู้ role ล่วงหน้า
 *
 * ลำดับการทำงาน:
 *   1) requireAuth() เช็คว่า login อยู่จริงไหม (ถ้าไม่ได้ login จะโดน redirect ไปหน้า index.html เอง)
 *   2) ถ้า login อยู่ ใช้ getHomeForRole() เพื่อหาว่า role นี้ควรไปหน้าไหน แล้ว redirect ทันที
 */

import { requireAuth, getHomeForRole } from '../auth/auth-guard.js';

async function redirect() {
  const profile = await requireAuth(); // ไม่จำกัด role แค่เช็คว่า login อยู่จริง
  if (!profile) return; // requireAuth จัดการ redirect ไป login ให้แล้วถ้าไม่ผ่าน

  window.location.href = getHomeForRole(profile.role);
}

redirect();