/**
 * qr-generate.js — แสดง/พิมพ์ QR Code ของกิจกรรม /pages/teacher/qr-generate.html?id=xxx
 * QR เข้ารหัสเป็นค่า activities.id (UUID) ตรงๆ (ต้องตรงกับที่ js/student/qr-scan.js คาดหวัง)
 *
 * ต้องโหลด library "qrcode" ผ่าน CDN ในหน้า HTML ก่อนใช้งาน:
 *   <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
 *
 * Element IDs ที่คาดหวัง:
 *   #qr-canvas, #qr-activity-name, #qr-activity-code, #btn-print
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

const canvas = document.getElementById('qr-canvas');
const nameEl = document.getElementById('qr-activity-name');
const codeEl = document.getElementById('qr-activity-code');
const printBtn = document.getElementById('btn-print');

async function init() {
  const profile = await requireAuth(['admin', 'teacher']);
  if (!profile) return;

  const params = new URLSearchParams(window.location.search);
  const activityId = params.get('id');
  if (!activityId) {
    Popup.error('ไม่พบกิจกรรม', 'ไม่ได้ระบุกิจกรรมที่ต้องการสร้าง QR Code');
    window.location.href = './activities.html';
    return;
  }

  const { data, error } = await supabaseClient
    .from('activities')
    .select('id,name,activity_code,qr_code', { filters: [['id', 'eq', activityId]] });

  if (error || !data || data.length === 0) {
    Popup.error('ไม่พบกิจกรรม', 'ไม่พบข้อมูลกิจกรรมนี้ในระบบ');
    return;
  }

  const activity = data[0];
  nameEl && (nameEl.textContent = activity.name);
  codeEl && (codeEl.textContent = activity.activity_code);

  // ถ้ายังไม่เคยตั้ง qr_code ให้ตั้งเป็น activity.id เอง (เข้ารหัสเรียบง่าย ตรวจสอบกับตารางกิจกรรมได้โดยตรง)
  if (!activity.qr_code) {
    await supabaseClient.from('activities').update({ qr_code: activity.id }, [['id', 'eq', activity.id]]);
  }

  renderQrCode(activity.id);
}

function renderQrCode(content) {
  if (!window.QRCode) {
    Popup.error('ไม่สามารถสร้าง QR Code ได้', 'ไม่พบ library qrcode กรุณาโหลด CDN ในหน้านี้ก่อน');
    return;
  }
  window.QRCode.toCanvas(canvas, content, { width: 260, margin: 2, color: { dark: '#1A1A1E', light: '#FFFFFF' } }, (err) => {
    if (err) {
      Popup.error('สร้าง QR Code ไม่สำเร็จ', 'เกิดข้อผิดพลาดในการสร้าง QR Code');
    }
  });
}

printBtn?.addEventListener('click', () => {
  window.print();
});

init();