/**
 * roles.js — หน้าจัดการสิทธิ์ (/pages/admin/roles.html)
 *
 * หมายเหตุสำคัญ: ระบบนี้ไม่มีตาราง `roles` แยกต่างหาก เพราะ role ถูกกำหนดตายตัว
 * เป็น 3 ค่า (admin/teacher/student) ผ่าน CHECK constraint ในตาราง `profiles`
 * และสิทธิ์การเข้าถึงข้อมูลจริงถูก "บังคับที่ชั้น Supabase Row Level Security (RLS)"
 * ไม่ใช่ตารางที่แก้ไขได้จาก UI (ตามหลัก sensitive logic ต้องพึ่ง RLS ไม่ใช่แค่ซ่อนปุ่มฝั่ง client)
 *
 * หน้านี้จึงทำหน้าที่เป็น "ตารางอ้างอิงสิทธิ์" (read-only) ให้ admin ดูภาพรวมว่าแต่ละ role
 * ทำอะไรได้บ้าง ถ้าต้องการเปลี่ยนสิทธิ์จริง ต้องแก้ไข RLS policy ในไฟล์ 001_schema.sql
 *
 * Element ID ที่คาดหวัง: #roles-matrix-body
 */

import { requireAuth } from '../auth/auth-guard.js';

const ROLE_PERMISSIONS = [
  {
    role: 'admin',
    label: 'ผู้ดูแลระบบ (Admin)',
    permissions: [
      'จัดการผู้ใช้งานและกำหนด role ได้ทั้งหมด',
      'จัดการ master data: ประเภทกิจกรรม, ปีการศึกษา, ภาควิชา, ห้องเรียน',
      'ดู/แก้ไขข้อมูลกิจกรรมทั้งหมดในระบบ',
      'ดูรายงานทุกประเภทและ System Logs',
    ],
  },
  {
    role: 'teacher',
    label: 'ครู (Teacher)',
    permissions: [
      'สร้าง/แก้ไข/ลบกิจกรรม เฉพาะกิจกรรมที่ตนเองรับผิดชอบ',
      'ดูกิจกรรมทั้งหมดในระบบได้ (view-only สำหรับกิจกรรมของคนอื่น)',
      'จัดการรายชื่อนักเรียนที่ลงทะเบียน อนุมัติ/ปฏิเสธ',
      'เช็กชื่อ ให้คะแนน บันทึกชั่วโมงกิจกรรม',
      'ดูรายงานกิจกรรม/นักเรียนที่เกี่ยวข้อง',
    ],
  },
  {
    role: 'student',
    label: 'นักเรียน (Student)',
    permissions: [
      'ลงทะเบียน/ยกเลิกลงทะเบียนกิจกรรม (ก่อนวันเริ่มกิจกรรม)',
      'เช็กชื่อด้วยการ scan QR Code',
      'ดูสถานะการลงทะเบียนและประวัติของตนเอง',
      'ดูคะแนน/ชั่วโมงสะสม และดาวน์โหลดใบประกาศนียบัตรของตนเอง',
    ],
  },
];

async function init() {
  const profile = await requireAuth(['admin']);
  if (!profile) return;
  renderMatrix();
}

function renderMatrix() {
  const tbody = document.getElementById('roles-matrix-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  ROLE_PERMISSIONS.forEach((roleInfo) => {
    const tr = document.createElement('tr');
    const permissionList = roleInfo.permissions.map((p) => `<li>${escapeHtml(p)}</li>`).join('');
    tr.innerHTML = `
      <td><span class="role-tag role-${roleInfo.role}">${escapeHtml(roleInfo.label)}</span></td>
      <td><ul class="role-permission-list">${permissionList}</ul></td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

init();