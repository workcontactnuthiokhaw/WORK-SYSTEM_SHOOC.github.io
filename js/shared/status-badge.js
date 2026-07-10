/**
 * status-badge.js — ฟังก์ชันกลางสำหรับ render Status Badge ให้เหมือนกันทุกหน้า
 * คู่กับ css/components/badge.css
 *
 * วิธีใช้:
 *   import { renderStatusBadge, ACTIVITY_STATUS_LABELS } from '../shared/status-badge.js';
 *   cell.innerHTML = renderStatusBadge('completed', ACTIVITY_STATUS_LABELS);
 */

export const ACTIVITY_STATUS_LABELS = {
  draft: 'ร่าง',
  published: 'เผยแพร่แล้ว',
  registration_open: 'เปิดลงทะเบียน',
  registration_closed: 'ปิดลงทะเบียน',
  ongoing: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
};

export const REGISTRATION_STATUS_LABELS = {
  pending_approval: 'รอการอนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ถูกปฏิเสธ',
  registered: 'ลงทะเบียนแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

export const ATTENDANCE_STATUS_LABELS = {
  registered: 'ยังไม่เช็กชื่อ',
  present: 'มาเข้าร่วม',
  absent: 'ขาด',
  late: 'มาสาย',
  completed: 'เสร็จสิ้น',
};

/**
 * สร้าง HTML ของ badge ตามสถานะ
 * @param {string} status - ค่าสถานะดิบจากฐานข้อมูล เช่น 'completed'
 * @param {object} labelMap - เช่น ACTIVITY_STATUS_LABELS (ถ้าไม่ส่งจะใช้ status ดิบเป็น label)
 * @param {boolean} small - true ถ้าต้องการ badge ขนาดเล็ก (ใช้ในตารางแถวแคบ)
 */
export function renderStatusBadge(status, labelMap = {}, small = false) {
  const label = labelMap[status] || status || '-';
  const sizeClass = small ? 'badge-sm' : '';
  return `<span class="badge badge-${status} ${sizeClass}">${escapeHtml(label)}</span>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}