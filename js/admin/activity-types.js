/**
 * activity-types.js — จัดการประเภทกิจกรรม (เข้าค่าย, กีฬาสี, วันวิชาการ, จิตอาสา ฯลฯ)
 * ใช้กับหน้า /pages/admin/activity-types.html
 * โครงสร้างเหมือน departments.js เพราะเป็นตาราง master data แบบง่าย (id, name)
 *
 * Element IDs ที่คาดหวัง:
 *   #activity-type-form, #activity-type-id (hidden), #activity-type-name
 *   #form-submit-btn, #form-reset-btn, #search-input
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

let allTypes = [];

const form = document.getElementById('activity-type-form');
const idInput = document.getElementById('activity-type-id');
const nameInput = document.getElementById('activity-type-name');
const submitBtn = document.getElementById('form-submit-btn');
const resetBtn = document.getElementById('form-reset-btn');
const searchInput = document.getElementById('search-input');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth(['admin']);
  if (!profile) return;
  await loadTypes();
}

async function loadTypes() {
  loadingState?.classList.remove('is-hidden');
  const { data, error } = await supabaseClient.from('activity_types').select('*', { order: 'name.asc' });
  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลประเภทกิจกรรมได้');
    return;
  }
  allTypes = data || [];
  renderTable(allTypes);
}

function renderTable(rows) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((type) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(type.name)}</td>
      <td class="cell-actions">
        <button class="btn btn-icon btn-edit" data-id="${type.id}" aria-label="แก้ไข"><i class="fi fi-rr-edit"></i></button>
        <button class="btn btn-icon btn-delete" data-id="${type.id}" aria-label="ลบ"><i class="fi fi-rr-trash"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function resetForm() {
  form?.reset();
  idInput.value = '';
  submitBtn.textContent = 'เพิ่มประเภทกิจกรรม';
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อประเภทกิจกรรม');
    return;
  }

  const editingId = idInput.value;
  submitBtn.disabled = true;
  submitBtn.classList.add('is-loading');

  const result = editingId
    ? await supabaseClient.from('activity_types').update({ name }, [['id', 'eq', editingId]])
    : await supabaseClient.from('activity_types').insert({ name });

  submitBtn.disabled = false;
  submitBtn.classList.remove('is-loading');

  if (result.error) {
    Popup.error('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    return;
  }

  Popup.toast('success', editingId ? 'แก้ไขประเภทกิจกรรมสำเร็จ' : 'เพิ่มประเภทกิจกรรมสำเร็จ');
  resetForm();
  await loadTypes();
});

resetBtn?.addEventListener('click', resetForm);

tableBody?.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.btn-edit');
  const deleteBtn = e.target.closest('.btn-delete');

  if (editBtn) {
    const type = allTypes.find((t) => t.id === editBtn.dataset.id);
    if (!type) return;
    idInput.value = type.id;
    nameInput.value = type.name;
    submitBtn.textContent = 'บันทึกการแก้ไข';
    nameInput.focus();
  }

  if (deleteBtn) {
    const confirmed = await Popup.confirm('ลบประเภทกิจกรรม', 'กิจกรรมที่ใช้ประเภทนี้อยู่อาจได้รับผลกระทบ ต้องการลบใช่หรือไม่?');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('activity_types').delete([['id', 'eq', deleteBtn.dataset.id]]);
    if (error) {
      Popup.error('ลบไม่สำเร็จ', 'อาจมีกิจกรรมที่ยังใช้ประเภทนี้อยู่');
      return;
    }
    Popup.toast('success', 'ลบประเภทกิจกรรมสำเร็จ');
    await loadTypes();
  }
});

searchInput?.addEventListener('input', () => {
  const keyword = searchInput.value.trim().toLowerCase();
  renderTable(allTypes.filter((t) => t.name.toLowerCase().includes(keyword)));
});

init();