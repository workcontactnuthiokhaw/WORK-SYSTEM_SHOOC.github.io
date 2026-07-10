/**
 * registration-limit.js — ตรวจสอบที่นั่งคงเหลือ/ปิดรับสมัครอัตโนมัติ
 *
 * ⚠️ หมายเหตุสำคัญ: ฟังก์ชันในไฟล์นี้ใช้เพื่อ "แสดงผล UX เบื้องต้น" เท่านั้น
 * (เช่น แสดงจำนวนที่นั่งเหลือ, ปิดปุ่มลงทะเบียนล่วงหน้าก่อนยิง request จริง)
 * การบังคับที่นั่งจริงแบบกันชนกัน (race condition) ถูกทำที่ระดับฐานข้อมูลแล้ว
 * ผ่าน trigger `check_registration_capacity` ในไฟล์ 001_schema.sql
 * ห้ามพึ่งพาไฟล์นี้เป็นตัวตัดสินสุดท้ายว่าลงทะเบียนได้หรือไม่
 *
 * วิธีใช้:
 *   import { getActivityCapacityInfo, isAlreadyRegistered } from '../shared/registration-limit.js';
 *   const info = await getActivityCapacityInfo(activityId, maxParticipants);
 *   if (info.isFull) { ปิดปุ่มลงทะเบียน }
 */

import supabaseClient from '../config/supabase-client.js';

/**
 * คืนค่าข้อมูลที่นั่งคงเหลือของกิจกรรม
 * @returns {Promise<{registeredCount:number, maxParticipants:number|null, remaining:number|null, isFull:boolean}>}
 */
export async function getActivityCapacityInfo(activityId, maxParticipants) {
  const { data, error } = await supabaseClient
    .from('registrations')
    .select('id', {
      filters: [
        ['activity_id', 'eq', activityId],
        ['status', 'in', '(registered,approved,pending_approval)'],
      ],
    });

  const registeredCount = error ? 0 : (data || []).length;
  const remaining = maxParticipants != null ? Math.max(0, maxParticipants - registeredCount) : null;
  const isFull = maxParticipants != null && registeredCount >= maxParticipants;

  return { registeredCount, maxParticipants, remaining, isFull };
}

/** เช็คว่านักเรียนคนนี้เคยลงทะเบียนกิจกรรมนี้ไปแล้วหรือยัง (กันลงซ้ำฝั่ง UX) */
export async function isAlreadyRegistered(studentId, activityId) {
  const { data, error } = await supabaseClient.from('registrations').select('id,status', {
    filters: [
      ['student_id', 'eq', studentId],
      ['activity_id', 'eq', activityId],
    ],
  });

  if (error || !data || data.length === 0) return { registered: false, status: null };
  return { registered: true, status: data[0].status };
}

/**
 * แสดง progress bar ที่นั่งคงเหลือ (คืน HTML string ใช้กับ .student-activity-seats-bar ใน student.css)
 */
export function renderSeatsBar(registeredCount, maxParticipants) {
  if (maxParticipants == null) {
    return `<div class="activity-card-seats">ไม่จำกัดที่นั่ง</div>`;
  }
  const percent = Math.min(100, (registeredCount / maxParticipants) * 100);
  return `
    <div class="student-activity-seats-bar">
      <div class="student-activity-seats-fill" style="width:${percent}%"></div>
    </div>
    <div class="activity-card-seats"><b>${registeredCount}</b> / ${maxParticipants} ที่นั่ง</div>
  `;
}