/**
 * departments.js — จัดการภาควิชา/แผนก (CRUD ง่ายๆ ไม่มี foreign key ลูก)
 * ใช้กับหน้า /pages/admin/departments.html
 *
 * Element IDs ที่คาดหวังในหน้า HTML:
 *   #department-form, #department-id (hidden), #department-name
 *   #form-submit-btn, #form-reset-btn
 *   #search-input
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

let allDepartments = [];

const form = document.getElementById('department-form');
const idInput = document.getElementById('department-id');
const nameInput = document.getElementById('department-name');
const submitBtn = document.getElementById('form-submit-btn');
const resetBtn = document.getElementById('form-reset-btn');
const searchInput = document.getElementById('search-input');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth(['admin']);
  if (!profile) return;
  await loadDepartments();
}

async function loadDepartments() {
  loadingState?.classList.remove('is-hidden');
  const { data, error } = await supabaseClient.from('departments').select('*', { order: 'name.asc' });
  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลภาควิชาได้ กรุณาลองใหม่อีกครั้ง');
    return;
  }
  allDepartments = data || [];
  renderTable(allDepartments);
}

function renderTable(rows) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((dept) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(dept.name)}</td>
      <td class="cell-actions">
        <button class="btn btn-icon btn-edit" data-id="${dept.id}" aria-label="แก้ไข"><i class="fi fi-rr-edit"></i></button>
        <button class="btn btn-icon btn-delete" data-id="${dept.id}" aria-label="ลบ"><i class="fi fi-rr-trash"></i></button>
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
  submitBtn.textContent = 'เพิ่มภาควิชา';
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อภาควิชา/แผนก');
    return;
  }

  const editingId = idInput.value;
  submitBtn.disabled = true;
  submitBtn.classList.add('is-loading');

  let result;
  if (editingId) {
    result = await supabaseClient.from('departments').update({ name }, [['id', 'eq', editingId]]);
  } else {
    result = await supabaseClient.from('departments').insert({ name });
  }

  submitBtn.disabled = false;
  submitBtn.classList.remove('is-loading');

  if (result.error) {
    Popup.error('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    return;
  }

  Popup.toast('success', editingId ? 'แก้ไขภาควิชาสำเร็จ' : 'เพิ่มภาควิชาสำเร็จ');
  resetForm();
  await loadDepartments();
});

resetBtn?.addEventListener('click', resetForm);

tableBody?.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.btn-edit');
  const deleteBtn = e.target.closest('.btn-delete');

  if (editBtn) {
    const dept = allDepartments.find((d) => d.id === editBtn.dataset.id);
    if (!dept) return;
    idInput.value = dept.id;
    nameInput.value = dept.name;
    submitBtn.textContent = 'บันทึกการแก้ไข';
    nameInput.focus();
  }

  if (deleteBtn) {
    const confirmed = await Popup.confirm('ลบภาควิชา', 'ต้องการลบภาควิชานี้ใช่หรือไม่? ห้องเรียนที่ผูกกับภาควิชานี้อาจได้รับผลกระทบ');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('departments').delete([['id', 'eq', deleteBtn.dataset.id]]);
    if (error) {
      Popup.error('ลบไม่สำเร็จ', 'อาจมีห้องเรียนที่ยังผูกกับภาควิชานี้อยู่');
      return;
    }
    Popup.toast('success', 'ลบภาควิชาสำเร็จ');
    await loadDepartments();
  }
});

searchInput?.addEventListener('input', () => {
  const keyword = searchInput.value.trim().toLowerCase();
  const filtered = allDepartments.filter((d) => d.name.toLowerCase().includes(keyword));
  renderTable(filtered);
});

init();