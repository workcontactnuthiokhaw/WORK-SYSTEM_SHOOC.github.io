/**
 * classes.js — จัดการห้องเรียน (ผูกกับภาควิชา + ปีการศึกษา)
 * ใช้กับหน้า /pages/admin/classes.html
 *
 * Element IDs ที่คาดหวัง:
 *   #class-form, #class-id (hidden), #class-name
 *   #class-department (select), #class-academic-year (select)
 *   #form-submit-btn, #form-reset-btn, #search-input
 *   #filter-department, #filter-academic-year
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

let allClasses = [];
let allDepartments = [];
let allAcademicYears = [];

const form = document.getElementById('class-form');
const idInput = document.getElementById('class-id');
const nameInput = document.getElementById('class-name');
const departmentSelect = document.getElementById('class-department');
const academicYearSelect = document.getElementById('class-academic-year');
const submitBtn = document.getElementById('form-submit-btn');
const resetBtn = document.getElementById('form-reset-btn');
const searchInput = document.getElementById('search-input');
const filterDepartment = document.getElementById('filter-department');
const filterAcademicYear = document.getElementById('filter-academic-year');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth(['admin']);
  if (!profile) return;
  await loadLookups();
  await loadClasses();
}

async function loadLookups() {
  const [deptRes, yearRes] = await Promise.all([
    supabaseClient.from('departments').select('*', { order: 'name.asc' }),
    supabaseClient.from('academic_years').select('*', { order: 'start_date.desc' }),
  ]);

  allDepartments = deptRes.data || [];
  allAcademicYears = yearRes.data || [];

  fillSelect(departmentSelect, allDepartments, 'เลือกภาควิชา/แผนก');
  fillSelect(academicYearSelect, allAcademicYears, 'เลือกปีการศึกษา', 'year_name');

  fillSelect(filterDepartment, allDepartments, 'ทุกภาควิชา', 'name', true);
  fillSelect(filterAcademicYear, allAcademicYears, 'ทุกปีการศึกษา', 'year_name', true);
}

function fillSelect(selectEl, items, placeholder, labelKey = 'name', isFilter = false) {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item[labelKey];
    selectEl.appendChild(opt);
  });
  if (isFilter) selectEl.value = '';
}

async function loadClasses() {
  loadingState?.classList.remove('is-hidden');
  const { data, error } = await supabaseClient
    .from('classes')
    .select('*,departments(name),academic_years(year_name)', { order: 'class_name.asc' });
  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลห้องเรียนได้');
    return;
  }
  allClasses = data || [];
  renderTable(allClasses);
}

function renderTable(rows) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((cls) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(cls.class_name)}</td>
      <td class="cell-muted">${escapeHtml(cls.departments?.name || '-')}</td>
      <td class="cell-muted">${escapeHtml(cls.academic_years?.year_name || '-')}</td>
      <td class="cell-actions">
        <button class="btn btn-icon btn-edit" data-id="${cls.id}" aria-label="แก้ไข"><i class="fi fi-rr-edit"></i></button>
        <button class="btn btn-icon btn-delete" data-id="${cls.id}" aria-label="ลบ"><i class="fi fi-rr-trash"></i></button>
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
  submitBtn.textContent = 'เพิ่มห้องเรียน';
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    class_name: nameInput.value.trim(),
    department_id: departmentSelect.value || null,
    academic_year_id: academicYearSelect.value || null,
  };

  if (!payload.class_name) {
    Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อห้องเรียน');
    return;
  }

  const editingId = idInput.value;
  submitBtn.disabled = true;
  submitBtn.classList.add('is-loading');

  const result = editingId
    ? await supabaseClient.from('classes').update(payload, [['id', 'eq', editingId]])
    : await supabaseClient.from('classes').insert(payload);

  submitBtn.disabled = false;
  submitBtn.classList.remove('is-loading');

  if (result.error) {
    Popup.error('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    return;
  }

  Popup.toast('success', editingId ? 'แก้ไขห้องเรียนสำเร็จ' : 'เพิ่มห้องเรียนสำเร็จ');
  resetForm();
  await loadClasses();
});

resetBtn?.addEventListener('click', resetForm);

tableBody?.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.btn-edit');
  const deleteBtn = e.target.closest('.btn-delete');

  if (editBtn) {
    const cls = allClasses.find((c) => c.id === editBtn.dataset.id);
    if (!cls) return;
    idInput.value = cls.id;
    nameInput.value = cls.class_name;
    departmentSelect.value = cls.department_id || '';
    academicYearSelect.value = cls.academic_year_id || '';
    submitBtn.textContent = 'บันทึกการแก้ไข';
    nameInput.focus();
  }

  if (deleteBtn) {
    const confirmed = await Popup.confirm('ลบห้องเรียน', 'นักเรียนที่ผูกกับห้องเรียนนี้อาจได้รับผลกระทบ ต้องการลบใช่หรือไม่?');
    if (!confirmed) return;

    const { error } = await supabaseClient.from('classes').delete([['id', 'eq', deleteBtn.dataset.id]]);
    if (error) {
      Popup.error('ลบไม่สำเร็จ', 'อาจมีนักเรียนที่ยังอยู่ในห้องเรียนนี้');
      return;
    }
    Popup.toast('success', 'ลบห้องเรียนสำเร็จ');
    await loadClasses();
  }
});

function applyFilters() {
  const keyword = (searchInput?.value || '').trim().toLowerCase();
  const deptFilter = filterDepartment?.value || '';
  const yearFilter = filterAcademicYear?.value || '';

  const filtered = allClasses.filter((cls) => {
    const matchKeyword = cls.class_name.toLowerCase().includes(keyword);
    const matchDept = !deptFilter || cls.department_id === deptFilter;
    const matchYear = !yearFilter || cls.academic_year_id === yearFilter;
    return matchKeyword && matchDept && matchYear;
  });
  renderTable(filtered);
}

searchInput?.addEventListener('input', applyFilters);
filterDepartment?.addEventListener('change', applyFilters);
filterAcademicYear?.addEventListener('change', applyFilters);

init();