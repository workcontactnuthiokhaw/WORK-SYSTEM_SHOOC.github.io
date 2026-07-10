/**
 * activity-form.js — ฟอร์มเพิ่ม/แก้ไขกิจกรรม /pages/teacher/activity-form.html?id=xxx
 * ถ้ามี query param ?id= จะเป็นโหมดแก้ไข ถ้าไม่มีจะเป็นโหมดสร้างใหม่
 * ตอนสร้างใหม่ ผู้สร้างจะถูกเพิ่มเป็นครูผู้รับผิดชอบ (หัวหน้า) อัตโนมัติใน activity_teachers
 *
 * Element IDs ที่คาดหวัง:
 *   #activity-form, #form-title
 *   #activity-name, #activity-code, #activity-type, #academic-year
 *   #description, #location, #start-datetime, #end-datetime
 *   #max-participants, #requires-approval, #status
 *   #form-submit-btn, #btn-cancel
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { isValidDateRange } from '../shared/validators.js';

let currentProfile = null;
let editingId = null;

const form = document.getElementById('activity-form');
const formTitle = document.getElementById('form-title');
const nameInput = document.getElementById('activity-name');
const codeInput = document.getElementById('activity-code');
const typeSelect = document.getElementById('activity-type');
const yearSelect = document.getElementById('academic-year');
const descInput = document.getElementById('description');
const locationInput = document.getElementById('location');
const startInput = document.getElementById('start-datetime');
const endInput = document.getElementById('end-datetime');
const maxParticipantsInput = document.getElementById('max-participants');
const requiresApprovalInput = document.getElementById('requires-approval');
const statusSelect = document.getElementById('status');
const submitBtn = document.getElementById('form-submit-btn');
const cancelBtn = document.getElementById('btn-cancel');

async function init() {
  currentProfile = await requireAuth(['admin', 'teacher']);
  if (!currentProfile) return;

  const params = new URLSearchParams(window.location.search);
  editingId = params.get('id');

  await loadLookups();

  if (editingId) {
    formTitle && (formTitle.textContent = 'แก้ไขกิจกรรม');
    submitBtn && (submitBtn.textContent = 'บันทึกการแก้ไข');
    await loadActivity(editingId);
  } else {
    formTitle && (formTitle.textContent = 'เพิ่มกิจกรรมใหม่');
    codeInput.value = generateActivityCode();
  }
}

function generateActivityCode() {
  const now = new Date();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ACT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${rand}`;
}

async function loadLookups() {
  const [typesRes, yearsRes] = await Promise.all([
    supabaseClient.from('activity_types').select('id,name', { order: 'name.asc' }),
    supabaseClient.from('academic_years').select('id,year_name', { order: 'start_date.desc' }),
  ]);

  fillSelect(typeSelect, typesRes.data || [], 'เลือกประเภทกิจกรรม', 'name');
  fillSelect(yearSelect, yearsRes.data || [], 'เลือกปีการศึกษา', 'year_name');
}

function fillSelect(selectEl, items, placeholder, labelKey) {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item[labelKey];
    selectEl.appendChild(opt);
  });
}

async function loadActivity(id) {
  const { data, error } = await supabaseClient.from('activities').select('*', { filters: [['id', 'eq', id]] });
  if (error || !data || data.length === 0) {
    Popup.error('ไม่พบกิจกรรม', 'ไม่พบข้อมูลกิจกรรมนี้ในระบบ');
    window.location.href = './activities.html';
    return;
  }

  const a = data[0];
  nameInput.value = a.name;
  codeInput.value = a.activity_code;
  typeSelect.value = a.activity_type_id || '';
  yearSelect.value = a.academic_year_id || '';
  descInput.value = a.description || '';
  locationInput.value = a.location || '';
  startInput.value = toDatetimeLocal(a.start_datetime);
  endInput.value = toDatetimeLocal(a.end_datetime);
  maxParticipantsInput.value = a.max_participants ?? '';
  requiresApprovalInput.checked = a.requires_approval;
  statusSelect.value = a.status;
}

function toDatetimeLocal(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: nameInput.value.trim(),
    activity_code: codeInput.value.trim(),
    activity_type_id: typeSelect.value || null,
    academic_year_id: yearSelect.value || null,
    description: descInput.value.trim() || null,
    location: locationInput.value.trim() || null,
    start_datetime: new Date(startInput.value).toISOString(),
    end_datetime: new Date(endInput.value).toISOString(),
    max_participants: maxParticipantsInput.value ? Number(maxParticipantsInput.value) : null,
    requires_approval: requiresApprovalInput.checked,
    status: statusSelect.value,
  };

  if (!payload.name || !payload.activity_code || !startInput.value || !endInput.value) {
    Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อกิจกรรม รหัสกิจกรรม และวันที่เริ่ม-สิ้นสุดให้ครบ');
    return;
  }

  const dateRangeError = isValidDateRange(startInput.value, endInput.value);
  if (dateRangeError) {
    Popup.warning('วันที่ไม่ถูกต้อง', dateRangeError);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add('is-loading');

  if (editingId) {
    const { error } = await supabaseClient.from('activities').update(payload, [['id', 'eq', editingId]]);
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-loading');

    if (error) {
      Popup.error('บันทึกไม่สำเร็จ', 'คุณอาจไม่มีสิทธิ์แก้ไขกิจกรรมนี้ (แก้ไขได้เฉพาะกิจกรรมที่ตนเองรับผิดชอบ)');
      return;
    }
    Popup.toast('success', 'แก้ไขกิจกรรมสำเร็จ');
    window.location.href = `./activity-detail.html?id=${editingId}`;
  } else {
    const { data, error } = await supabaseClient.from('activities').insert({ ...payload, created_by: currentProfile.id });
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-loading');

    if (error || !data || data.length === 0) {
      Popup.error('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการสร้างกิจกรรม');
      return;
    }

    const newActivityId = data[0].id;

    // เพิ่มผู้สร้างเป็นครูผู้รับผิดชอบหลัก (หัวหน้า) อัตโนมัติ
    await supabaseClient.from('activity_teachers').insert({
      activity_id: newActivityId,
      teacher_id: currentProfile.id,
      role_in_activity: 'หัวหน้า',
    });

    Popup.toast('success', 'สร้างกิจกรรมสำเร็จ');
    window.location.href = `./activity-detail.html?id=${newActivityId}`;
  }
});

cancelBtn?.addEventListener('click', () => {
  window.location.href = './activities.html';
});

init();