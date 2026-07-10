/**
 * academic-years.js — จัดการปีการศึกษา
 * ใช้กับหน้า /pages/admin/academic-years.html
 *
 * Business rule พิเศษ: เปิด is_active ได้ทีละ 1 ปีเท่านั้น
 * (เวลาติ๊กปีใหม่เป็น active ต้องปิด active ของปีอื่นทั้งหมดก่อน)
 *
 * Element IDs ที่คาดหวัง:
 *   #academic-year-form, #academic-year-id (hidden)
 *   #year-name, #start-date, #end-date, #is-active
 *   #form-submit-btn, #form-reset-btn, #search-input
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

let allYears = [];

const form = document.getElementById('academic-year-form');
const idInput = document.getElementById('academic-year-id');
const yearNameInput = document.getElementById('year-name');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const isActiveInput = document.getElementById('is-active');
const submitBtn = document.getElementById('form-submit-btn');
const resetBtn = document.getElementById('form-reset-btn');
const searchInput = document.getElementById('search-input');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth(['admin']);
  if (!profile) return;
  await loadYears();
}

async function loadYears() {
  loadingState?.classList.remove('is-hidden');
  const { data, error } = await supabaseClient.from('academic_years').select('*', { order: 'start_date.desc' });
  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลปีการศึกษาได้');
    return;
  }
  allYears = data || [];
  renderTable(allYears);
}

function renderTable(rows) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((year) => {
    const tr = document.createElement('tr');
    if (year.is_active) tr.classList.add('academic-year-row', 'is-active');
    tr.innerHTML = `
      <td>${escapeHtml(year.year_name)}</td>
      <td class="cell-muted">${formatDate(year.start_date)}</td>
      <td class="cell-muted">${formatDate(year.end_date)}</td>
      <td>${year.is_active ? '<span class="badge badge-active">กำลังใช้งาน</span>' : '<span class="badge badge-cancelled">ปิดใช้งาน</span>'}</td>
      <td class="cell-actions">
        <button class="btn btn-icon btn-edit" data-id="${year.id}" aria-label="แก้ไข"><i class="fi fi-rr-edit"></i></button>
        <button class="btn btn-icon btn-delete" data-id="${year.id}" aria-label="ลบ"><i class="fi fi-rr-trash"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function resetForm() {
  form?.reset();
  idInput.value = '';
  submitBtn.textContent = 'เพิ่มปีการศึกษา';
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    year_name: yearNameInput.value.trim(),
    start_date: startDateInput.value,
    end_date: endDateInput.value,
    is_active: isActiveInput.checked,
  };

  if (!payload.year_name || !payload.start_date || !payload.end_date) {
    Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อปีการศึกษาและวันที่เริ่ม-สิ้นสุดให้ครบ');
    return;
  }

  if (new Date(payload.end_date) < new Date(payload.start_date)) {
    Popup.warning('วันที่ไม่ถูกต้อง', 'วันสิ้นสุดต้องมาหลังวันเริ่มต้น');
    return;
  }

  const editingId = idInput.value;

  // ถ้าติ๊กให้ปีนี้ active ต้องปิด active ของปีอื่นทั้งหมดก่อน (มี active ได้ทีละปีเท่านั้น)
  if (payload.is_active) {
    const confirmed = await Popup.confirm(
      'ยืนยันการตั้งเป็นปีการศึกษาปัจจุบัน',
      'ระบบจะปิดสถานะ "กำลังใช้งาน" ของปีการศึกษาอื่นทั้งหมดโดยอัตโนมัติ ต้องการดำเนินการต่อหรือไม่?'
    );
    if (!confirmed) return;

    const { error: deactivateError } = await supabaseClient
      .from('academic_years')
      .update({ is_active: false }, [['is_active', 'eq', true]]);
    if (deactivateError) {
      Popup.error('เกิดข้อผิดพลาด', 'ไม่สามารถปิดปีการศึกษาอื่นได้ กรุณาลองใหม่');
      return;
    }
  }

  submitBtn.disabled = true;
  submitBtn.classList.add('is-loading');

  const result = editingId
    ? await supabaseClient.from('academic_years').update(payload, [['id', 'eq', editingId]])
    : await supabaseClient.from('academic_years').insert(payload);

  submitBtn.disabled = false;
  submitBtn.classList.remove('is-loading');

  if (result.error) {
    Popup.error('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    return;
  }

  Popup.toast('success', editingId ? 'แก้ไขปีการศึกษาสำเร็จ' : 'เพิ่มปีการศึกษาสำเร็จ');
  resetForm();
  await loadYears();
});

resetBtn?.addEventListener('click', resetForm);

tableBody?.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.btn-edit');
  const deleteBtn = e.target.closest('.btn-delete');

  if (editBtn) {
    const year = allYears.find((y) => y.id === editBtn.dataset.id);
    if (!year) return;
    idInput.value = year.id;
    yearNameInput.value = year.year_name;
    startDateInput.value = year.start_date;
    endDateInput.value = year.end_date;
    isActiveInput.checked = year.is_active;
    submitBtn.textContent = 'บันทึกการแก้ไข';
    yearNameInput.focus();
  }

  if (deleteBtn) {
    const confirmed = await Popup.confirm('ลบปีการศึกษา', 'ห้องเรียน/กิจกรรมที่ผูกกับปีนี้อาจได้รับผลกระทบ ต้องการลบใช่หรือไม่?');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('academic_years').delete([['id', 'eq', deleteBtn.dataset.id]]);
    if (error) {
      Popup.error('ลบไม่สำเร็จ', 'อาจมีห้องเรียนหรือกิจกรรมที่ยังผูกกับปีนี้อยู่');
      return;
    }
    Popup.toast('success', 'ลบปีการศึกษาสำเร็จ');
    await loadYears();
  }
});

searchInput?.addEventListener('input', () => {
  const keyword = searchInput.value.trim().toLowerCase();
  renderTable(allYears.filter((y) => y.year_name.toLowerCase().includes(keyword)));
});

init();