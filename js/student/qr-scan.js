/**
 * qr-scan.js — เปิดกล้องมือถือ scan QR เพื่อเช็กชื่อเข้าร่วมกิจกรรม /pages/student/qr-scan.html
 *
 * QR ของแต่ละกิจกรรม (สร้างโดย js/teacher/qr-generate.js) เข้ารหัสเป็นค่า activities.id (UUID) ตรงๆ
 *
 * ต้องโหลด jsQR ผ่าน CDN ในหน้า HTML ก่อนใช้งาน:
 *   <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
 *
 * Element IDs ที่คาดหวัง:
 *   #qr-video, #qr-canvas (ซ่อนไว้ ใช้ประมวลผลเฟรมเท่านั้น)
 *   #qr-scan-status, #btn-start-scan
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { generateAndUploadCertificate } from '../shared/certificate-generator.js';

let currentProfile = null;
let scanning = false;
let videoStream = null;

const video = document.getElementById('qr-video');
const canvas = document.getElementById('qr-canvas');
const statusEl = document.getElementById('qr-scan-status');
const startBtn = document.getElementById('btn-start-scan');

async function init() {
  currentProfile = await requireAuth(['student']);
  if (!currentProfile) return;
}

async function startScan() {
  if (!window.jsQR) {
    Popup.error('ไม่สามารถเปิดกล้องได้', 'ไม่พบ jsQR กรุณาโหลด CDN ของ jsQR ในหน้านี้ก่อน');
    return;
  }

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (err) {
    Popup.error('เปิดกล้องไม่สำเร็จ', 'กรุณาอนุญาตให้เว็บไซต์เข้าถึงกล้องของอุปกรณ์');
    return;
  }

  video.srcObject = videoStream;
  await video.play();
  scanning = true;
  setStatus('กำลังสแกน... กรุณาส่อง QR Code ของกิจกรรมให้อยู่ในกรอบ');
  requestAnimationFrame(scanLoop);
}

function stopScan() {
  scanning = false;
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
    videoStream = null;
  }
}

function scanLoop() {
  if (!scanning) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data) {
      stopScan();
      handleScanResult(code.data.trim());
      return;
    }
  }

  requestAnimationFrame(scanLoop);
}

async function handleScanResult(activityId) {
  setStatus('กำลังตรวจสอบข้อมูล...');

  // 1) หากิจกรรมจาก id ที่ scan ได้
  const { data: activityRows, error: activityError } = await supabaseClient
    .from('activities')
    .select('id,name,academic_year_id', { filters: [['id', 'eq', activityId]] });

  if (activityError || !activityRows || activityRows.length === 0) {
    setStatus('ไม่พบกิจกรรมนี้ในระบบ');
    Popup.error('QR ไม่ถูกต้อง', 'ไม่พบกิจกรรมที่ตรงกับ QR Code นี้');
    return;
  }
  const activity = activityRows[0];

  // 2) เช็คว่ามี registration ที่ approved/registered อยู่หรือไม่
  const { data: regRows } = await supabaseClient
    .from('registrations')
    .select('id,status', { filters: [['student_id', 'eq', currentProfile.id], ['activity_id', 'eq', activity.id]] });

  const validReg = (regRows || []).find((r) => ['registered', 'approved'].includes(r.status));

  if (!validReg) {
    setStatus('คุณยังไม่ได้ลงทะเบียน หรือยังไม่ได้รับการอนุมัติสำหรับกิจกรรมนี้');
    Popup.warning('ไม่สามารถเช็กชื่อได้', 'คุณต้องลงทะเบียนและได้รับการอนุมัติก่อนจึงจะเช็กชื่อได้');
    return;
  }

  // 3) เช็คว่าเช็กชื่อไปแล้วหรือยัง
  const { data: attRows } = await supabaseClient
    .from('attendance')
    .select('*', { filters: [['student_id', 'eq', currentProfile.id], ['activity_id', 'eq', activity.id]] });

  if (attRows && attRows.length > 0 && attRows[0].status === 'completed') {
    setStatus('คุณเช็กชื่อกิจกรรมนี้ไปแล้ว');
    Popup.information('เช็กชื่อไปแล้ว', 'คุณได้เช็กชื่อเข้าร่วมกิจกรรมนี้เรียบร้อยแล้วก่อนหน้านี้');
    return;
  }

  // 4) บันทึกเช็กชื่อ -> status = 'completed' ทันที (ไม่มี check-out แยก ตาม business logic)
  const now = new Date().toISOString();
  const attendancePayload = { student_id: currentProfile.id, activity_id: activity.id, check_in_time: now, status: 'completed' };

  const result = attRows && attRows.length > 0
    ? await supabaseClient.from('attendance').update(attendancePayload, [['id', 'eq', attRows[0].id]])
    : await supabaseClient.from('attendance').insert(attendancePayload);

  if (result.error) {
    setStatus('เช็กชื่อไม่สำเร็จ กรุณาลองใหม่');
    Popup.error('เช็กชื่อไม่สำเร็จ', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    return;
  }

  setStatus(`เช็กชื่อสำเร็จ! ยินดีต้อนรับสู่กิจกรรม "${activity.name}"`);
  Popup.success('เช็กชื่อสำเร็จ', `บันทึกการเข้าร่วมกิจกรรม "${activity.name}" เรียบร้อยแล้ว`);

  // 5) สร้างใบประกาศนียบัตร (แถวใน certificates ถูกสร้างแล้วโดย trigger ฝั่ง DB)
  await tryGenerateCertificate(activity);
}

async function tryGenerateCertificate(activity) {
  // รอ + เช็คซ้ำหลายรอบ ให้ trigger ฝั่ง DB สร้างแถว certificates เสร็จก่อน
  let certRows = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const { data } = await supabaseClient
      .from('certificates')
      .select('*', { filters: [['student_id', 'eq', currentProfile.id], ['activity_id', 'eq', activity.id]] });
    if (data && data.length > 0) {
      certRows = data;
      break;
    }
  }

  if (!certRows || certRows.length === 0) return; // ให้ไปโหลดใหม่ทีหลังในหน้า certificates.html ได้อยู่แล้ว

  const { data: profileRows } = await supabaseClient
    .from('profiles')
    .select('full_name', { filters: [['id', 'eq', currentProfile.id]] });

  const studentName = profileRows?.[0]?.full_name || 'นักเรียน';

  await generateAndUploadCertificate({
    studentId: currentProfile.id,
    activityId: activity.id,
    studentName,
    activityName: activity.name,
    certificateNo: certRows[0].certificate_no,
    issueDate: certRows[0].issue_date,
    schoolName: 'Rmutr School',
  });
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

startBtn?.addEventListener('click', startScan);
window.addEventListener('beforeunload', stopScan);

init();