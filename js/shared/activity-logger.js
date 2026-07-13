/**
 * activity-logger.js — บันทึก log กิจกรรมของผู้ใช้ลงตาราง logs ใน Supabase
 * ใช้ร่วมกันทุกหน้าที่มีการ login/logout หรือแก้ไขข้อมูล
 *
 * หมายเหตุสำคัญ: การเขียน log เป็นแบบ "best-effort" — ถ้าเขียนไม่สำเร็จ (เช่น network ล้ม)
 * จะไม่ throw error ขัดจังหวะการทำงานหลัก เพราะธุรกรรมจริง (บันทึกข้อมูล/login) ต้องสำเร็จ
 * ก่อนเสมอ ต่อให้บันทึก log ไม่ได้ก็ไม่ควรทำให้ผู้ใช้งานหลักล้มเหลวไปด้วย
 *
 * วิธีใช้:
 *   import { logAction } from '../shared/activity-logger.js';
 *   await logAction('create', 'departments', { name: 'วิทยาศาสตร์' });
 *   await logAction('login', null, { email }, userId); // ตอน login ระบุ userId ตรงๆ เพราะ cache ยังไม่ทัน
 */

import supabaseClient from '../config/supabase-client.js';

const PROFILE_CACHE_KEY = 'sams_current_profile';

function getCurrentUserId() {
  const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.id || null;
  } catch {
    return null;
  }
}

/**
 * บันทึก log 1 รายการ
 * @param {string} action - 'login' | 'logout' | 'create' | 'update' | 'delete' | 'check_in' | 'grade'
 * @param {string|null} tableName - ชื่อตารางที่เกี่ยวข้อง เช่น 'departments' (null ได้ถ้าไม่ผูกกับตารางใดตารางหนึ่งตรงๆ)
 * @param {object} detail - ข้อมูลเพิ่มเติม (jsonb) เช่น { id, name }
 * @param {string} [userIdOverride] - ระบุ user_id เอง (ใช้ตอน login ที่ profile ยังไม่ถูก cache)
 */
export async function logAction(action, tableName, detail = {}, userIdOverride = null) {
  const userId = userIdOverride || getCurrentUserId();
  if (!userId) return; // ไม่มี user ให้ผูก log ก็ไม่ต้องบันทึก

  try {
    await supabaseClient.from('logs').insert({
      user_id: userId,
      action,
      table_name: tableName,
      detail,
    });
  } catch {
    // เขียน log ไม่สำเร็จ ไม่ต้องขัดจังหวะผู้ใช้ (best-effort เท่านั้น)
  }
}