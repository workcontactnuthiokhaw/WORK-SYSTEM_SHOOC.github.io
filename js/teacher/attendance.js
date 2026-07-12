/**
 * attendance.js — เช็กชื่อ/ให้คะแนน/บันทึกชั่วโมง /pages/teacher/attendance.html?id=xxx
 * แสดงรายชื่อนักเรียนที่ลงทะเบียนแล้ว (registered/approved) ให้ครูกรอกคะแนน+ชั่วโมง
 * แล้ว mark สถานะเป็น completed (การ mark completed จะ trigger สร้างใบประกาศนียบัตรอัตโนมัติฝั่ง DB)
 *
 * Element IDs ที่คาดหวัง:
 *   #activity-title, #attendance-table-body, #empty-state, #loading-state
 *   #btn-save-all
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { renderStatusBadge, ATTENDANCE_STATUS_LABELS } from '../shared/status-badge.js';
import { generateAndUploadCertificate } from '../shared/certificate-generator.js';

let activityId = null;
let activityName = '';
let currentProfile = null;
let rows = [];

const titleEl = document.getElementById('activity-title');
const tableBody = document.getElementById('attendance-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const saveAllBtn = document.getElementById('btn-save-all');

async function init() {
  currentProfile = await requireAuth(['admin', 'teacher']);
  if (!currentProfile) return;

  const params = new URLSearchParams(window.location.search);
  activityId = params.get('id');
  if (!activityId) {
    Popup.error('ไม่พบกิจกรรม', 'ไม่ได้ระบุกิจกรรมที่ต้องการเช็กชื่อ');
    window.location.href = './activities.html';
    return;
  }

  await loadActivityInfo();
  await loadParticipants();
}

async function loadActivityInfo() {
  const { data } = await supabaseClient.from('activities').select('name', { filters: [['id', 'eq', activityId]] });
  if (data && data.length > 0) {
    activityName = data[0].name;
    if (titleEl) titleEl.textContent = `เช็กชื่อ/ให้คะแนน: ${activityName}`;
  }
}

async function loadParticipants() {
  loadingState?.classList.remove('is-hidden');

  const [regResult, attResult] = await Promise.all([
    supabaseClient
      .from('registrations')
      .select('student_id,status,students(student_code,classes(class_name),profiles(full_name))', {
        filters: [['activity_id', 'eq', activityId], ['status', 'in', '(registered,approved)']],
      }),
    supabaseClient
      .from('attendance')
      .select('*', { filters: [['activity_id', 'eq', activityId]] }),
  ]);

  const { data: registrations, error: regError } = regResult;
  const { data: attendanceRows } = attResult;

  loadingState?.classList.add('is-hidden');

  if (regError) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงรายชื่อผู้เข้าร่วมได้');
    return;
  }

  rows = (registrations || []).map((r) => {
    const att = (attendanceRows || []).find((a) => a.student_id === r.student_id);
    return {
      student_id: r.student_id,
      student_code: r.students?.student_code || '-',
      full_name: r.students?.profiles?.full_name || '-',
      class_name: r.students?.classes?.class_name || '-',
      check_in_time: att?.check_in_time || null,
      status: att?.status || 'registered',
      score: att?.score ?? '',
      hours_earned: att?.hours_earned ?? '',
    };
  });

  renderTable();
}

function renderTable() {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((r, index) => {
    const tr = document.createElement('tr');
    tr.dataset.index = index;
    tr.innerHTML = `
      <td>${escapeHtml(r.student_code)}</td>
      <td>${escapeHtml(r.full_name)}</td>
      <td class="cell-muted">${escapeHtml(r.class_name)}</td>
      <td class="${r.check_in_time ? 'attendance-checkin-time' : 'attendance-checkin-time not-checked-in'}">
        ${r.check_in_time ? new Date(r.check_in_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : 'ยังไม่เช็กชื่อ'}
      </td>
      <td><input type="number" class="attendance-score-input input-score" min="0" step="0.5" value="${r.score}" /></td>
      <td><input type="number" class="attendance-score-input input-hours" min="0" step="0.5" value="${r.hours_earned}" /></td>
      <td>${renderStatusBadge(r.status, ATTENDANCE_STATUS_LABELS, true)}</td>
      <td class="cell-actions">
        <button class="btn btn-primary btn-sm btn-save-row" data-index="${index}">บันทึก</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  tableBody.querySelectorAll('.btn-save-row').forEach((btn) => {
    btn.addEventListener('click', () => saveRow(Number(btn.dataset.index)));
  });
}

async function saveRow(index) {
  const row = rows[index];
  const tr = tableBody.querySelector(`tr[data-index="${index}"]`);
  const score = tr.querySelector('.input-score').value;
  const hours = tr.querySelector('.input-hours').value;

  const payload = {
    student_id: row.student_id,
    activity_id: activityId,
    score: score === '' ? null : Number(score),
    hours_earned: hours === '' ? null : Number(hours),
    status: 'completed',
    graded_by: currentProfile.id,
    check_in_time: row.check_in_time || new Date().toISOString(),
  };

  const { data: existing } = await supabaseClient
    .from('attendance')
    .select('id', { filters: [['student_id', 'eq', row.student_id], ['activity_id', 'eq', activityId]] });

  const result = existing && existing.length > 0
    ? await supabaseClient.from('attendance').update(payload, [['id', 'eq', existing[0].id]])
    : await supabaseClient.from('attendance').insert(payload);

  if (result.error) {
    Popup.error('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกคะแนน/ชั่วโมง');
    return;
  }

  Popup.toast('success', `บันทึกข้อมูลของ ${row.full_name} สำเร็จ กำลังออกใบประกาศนียบัตร...`);
  await tryGenerateCertificate(row);
  await loadParticipants();
}

/** รอ + เช็คซ้ำหลายรอบ (retry) ให้ trigger ฝั่ง DB สร้างแถว certificates เสร็จก่อน
 *  แล้วค่อย generate ไฟล์ PDF จริงอัปโหลดขึ้น storage (เดิมรอครั้งเดียว 1 วิ ถ้าช้ากว่านั้น
 *  จะหาแถวไม่เจอแล้วเงียบๆ ไม่ generate ไฟล์ให้ ไม่มี error ให้เห็นเลย) */
async function tryGenerateCertificate(row) {
  let certRows = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const { data } = await supabaseClient
      .from('certificates')
      .select('*', { filters: [['student_id', 'eq', row.student_id], ['activity_id', 'eq', activityId]] });

    if (data && data.length > 0) {
      certRows = data;
      break;
    }
  }

  if (!certRows || certRows.length === 0) {
    Popup.warning('ยังไม่ได้ออกใบประกาศนียบัตร', 'ระบบหลังบ้านสร้างข้อมูลช้ากว่าปกติ กรุณากด "บันทึก" อีกครั้งเพื่อลองใหม่');
    return;
  }
  if (certRows[0].file_url) return; // มีไฟล์อยู่แล้ว ไม่ต้อง generate ซ้ำ

  const result = await generateAndUploadCertificate({
    studentId: row.student_id,
    activityId,
    studentName: row.full_name,
    activityName,
    certificateNo: certRows[0].certificate_no,
    issueDate: certRows[0].issue_date,
    schoolName: 'Rmutr School',
  });

  if (!result.success) {
    Popup.error('ออกใบประกาศนียบัตรไม่สำเร็จ', result.error || 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF กรุณาลองกดบันทึกอีกครั้ง');
  }
}

async function saveAll() {
  const confirmed = await Popup.confirm('บันทึกทั้งหมด', 'ต้องการบันทึกคะแนน/ชั่วโมงของทุกคนในตารางและมาร์คว่าเสร็จสิ้นใช่หรือไม่?');
  if (!confirmed) return;

  for (let i = 0; i < rows.length; i++) {
    await saveRow(i);
  }
  Popup.success('บันทึกสำเร็จ', 'บันทึกคะแนน/ชั่วโมงของทุกคนเรียบร้อยแล้ว');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

saveAllBtn?.addEventListener('click', saveAll);

init();