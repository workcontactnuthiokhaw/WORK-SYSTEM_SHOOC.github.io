/**
 * student-report.js — รายงานนักเรียน /pages/reports/student-report.html
 * สรุปจำนวนกิจกรรมที่เข้าร่วม/คะแนน/ชั่วโมงสะสม ต่อนักเรียนแต่ละคน filter ตามห้องเรียน/ปีการศึกษา
 *
 * Element IDs ที่คาดหวัง:
 *   #filter-class, #filter-academic-year, #btn-apply-filter
 *   #btn-export-pdf, #btn-export-excel, #btn-export-csv
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { exportToPdf, exportToExcel, exportToCsv } from './export-utils.js';

let currentRows = [];

const classSelect = document.getElementById('filter-class');
const yearSelect = document.getElementById('filter-academic-year');
const applyBtn = document.getElementById('btn-apply-filter');
const exportPdfBtn = document.getElementById('btn-export-pdf');
const exportExcelBtn = document.getElementById('btn-export-excel');
const exportCsvBtn = document.getElementById('btn-export-csv');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth(['admin', 'teacher']);
  if (!profile) return;
  await loadFilterOptions();
  await loadReport();
}

async function loadFilterOptions() {
  const [classesRes, yearsRes] = await Promise.all([
    supabaseClient.from('classes').select('id,class_name', { order: 'class_name.asc' }),
    supabaseClient.from('academic_years').select('id,year_name', { order: 'start_date.desc' }),
  ]);

  fillSelect(classSelect, classesRes.data || [], 'ทุกห้องเรียน', 'class_name');
  fillSelect(yearSelect, yearsRes.data || [], 'ทุกปีการศึกษา', 'year_name');
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

async function loadReport() {
  loadingState?.classList.remove('is-hidden');

  const studentFilters = [];
  if (classSelect?.value) studentFilters.push(['class_id', 'eq', classSelect.value]);

  const { data: students, error: studentsError } = await supabaseClient
    .from('students')
    .select('id,student_code,classes(class_name),profiles(full_name)', { filters: studentFilters });

  if (studentsError) {
    loadingState?.classList.add('is-hidden');
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลนักเรียนได้');
    return;
  }

  const studentIds = (students || []).map((s) => s.id);

  let attendanceFilters = [];
  if (studentIds.length) attendanceFilters.push(['student_id', 'in', `(${studentIds.join(',')})`]);

  const { data: attendance } = studentIds.length
    ? await supabaseClient.from('attendance').select('student_id,activity_id,status,score,hours_earned,activities(academic_year_id)', { filters: attendanceFilters })
    : { data: [] };

  loadingState?.classList.add('is-hidden');

  const yearFilterValue = yearSelect?.value || '';

  currentRows = (students || []).map((s) => {
    let relevant = (attendance || []).filter((a) => a.student_id === s.id && a.status === 'completed');
    if (yearFilterValue) {
      relevant = relevant.filter((a) => a.activities?.academic_year_id === yearFilterValue);
    }
    const totalActivities = relevant.length;
    const totalHours = relevant.reduce((sum, a) => sum + (Number(a.hours_earned) || 0), 0);
    const totalScore = relevant.reduce((sum, a) => sum + (Number(a.score) || 0), 0);

    return {
      student_code: s.student_code,
      full_name: s.profiles?.full_name || '-',
      class_name: s.classes?.class_name || '-',
      total_activities: totalActivities,
      total_hours: totalHours,
      total_score: totalScore,
    };
  });

  renderTable(currentRows);
}

function renderTable(rows) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.student_code)}</td>
      <td>${escapeHtml(r.full_name)}</td>
      <td class="cell-muted">${escapeHtml(r.class_name)}</td>
      <td>${r.total_activities}</td>
      <td>${r.total_hours.toLocaleString('th-TH')}</td>
      <td>${r.total_score.toLocaleString('th-TH')}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function toExportRows() {
  const columns = ['รหัสนักเรียน', 'ชื่อ-สกุล', 'ห้องเรียน', 'จำนวนกิจกรรมที่เข้าร่วม', 'ชั่วโมงสะสม', 'คะแนนสะสม'];
  const rows = currentRows.map((r) => [r.student_code, r.full_name, r.class_name, r.total_activities, r.total_hours, r.total_score]);
  return { columns, rows };
}

applyBtn?.addEventListener('click', loadReport);

exportPdfBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToPdf('รายงานนักเรียน', columns, rows, `student-report-${Date.now()}.pdf`);
});

exportExcelBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToExcel('รายงานนักเรียน', columns, rows, `student-report-${Date.now()}.xlsx`);
});

exportCsvBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToCsv(columns, rows, `student-report-${Date.now()}.csv`);
});

init();