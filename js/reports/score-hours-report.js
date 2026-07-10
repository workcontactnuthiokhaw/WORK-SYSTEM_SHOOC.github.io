/**
 * score-hours-report.js — รายงานคะแนน/ชั่วโมงกิจกรรม /pages/reports/score-hours-report.html
 * แสดงรายละเอียดระดับ "รายกิจกรรมต่อคน" (ไม่ใช่สรุปรวมแบบ student-report)
 * filter ได้ตามปีการศึกษา/กิจกรรม/ห้องเรียน
 *
 * Element IDs ที่คาดหวัง:
 *   #filter-academic-year, #filter-activity, #filter-class, #btn-apply-filter
 *   #btn-export-pdf, #btn-export-excel, #btn-export-csv
 *   #data-table-body, #empty-state, #loading-state
 *   #summary-total-hours, #summary-total-score
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { exportToPdf, exportToExcel, exportToCsv } from './export-utils.js';

let currentRows = [];

const yearSelect = document.getElementById('filter-academic-year');
const activitySelect = document.getElementById('filter-activity');
const classSelect = document.getElementById('filter-class');
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
  const [yearsRes, activitiesRes, classesRes] = await Promise.all([
    supabaseClient.from('academic_years').select('id,year_name', { order: 'start_date.desc' }),
    supabaseClient.from('activities').select('id,name', { order: 'start_datetime.desc' }),
    supabaseClient.from('classes').select('id,class_name', { order: 'class_name.asc' }),
  ]);

  fillSelect(yearSelect, yearsRes.data || [], 'ทุกปีการศึกษา', 'year_name');
  fillSelect(activitySelect, activitiesRes.data || [], 'ทุกกิจกรรม', 'name');
  fillSelect(classSelect, classesRes.data || [], 'ทุกห้องเรียน', 'class_name');
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

  const filters = [['status', 'eq', 'completed']];
  if (activitySelect?.value) filters.push(['activity_id', 'eq', activitySelect.value]);

  const { data: attendance, error } = await supabaseClient
    .from('attendance')
    .select(
      'id,score,hours_earned,check_in_time,students(student_code,class_id,classes(class_name),profiles(full_name)),activities(name,academic_year_id,academic_years(year_name))',
      { filters, order: 'check_in_time.desc' }
    );

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลคะแนน/ชั่วโมงกิจกรรมได้');
    return;
  }

  let rows = attendance || [];

  if (yearSelect?.value) {
    rows = rows.filter((r) => r.activities?.academic_year_id === yearSelect.value);
  }
  if (classSelect?.value) {
    rows = rows.filter((r) => r.students?.class_id === classSelect.value);
  }

  currentRows = rows.map((r) => ({
    student_code: r.students?.student_code || '-',
    full_name: r.students?.profiles?.full_name || '-',
    class_name: r.students?.classes?.class_name || '-',
    activity_name: r.activities?.name || '-',
    academic_year: r.activities?.academic_years?.year_name || '-',
    score: Number(r.score) || 0,
    hours_earned: Number(r.hours_earned) || 0,
    check_in_time: r.check_in_time,
  }));

  renderTable(currentRows);
  renderSummary(currentRows);
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
      <td>${escapeHtml(r.activity_name)}</td>
      <td class="cell-muted">${escapeHtml(r.academic_year)}</td>
      <td>${r.score}</td>
      <td>${r.hours_earned}</td>
      <td class="cell-muted">${r.check_in_time ? new Date(r.check_in_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function renderSummary(rows) {
  const totalHours = rows.reduce((sum, r) => sum + r.hours_earned, 0);
  const totalScore = rows.reduce((sum, r) => sum + r.score, 0);
  const hoursEl = document.getElementById('summary-total-hours');
  const scoreEl = document.getElementById('summary-total-score');
  if (hoursEl) hoursEl.textContent = totalHours.toLocaleString('th-TH');
  if (scoreEl) scoreEl.textContent = totalScore.toLocaleString('th-TH');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function toExportRows() {
  const columns = ['รหัสนักเรียน', 'ชื่อ-สกุล', 'ห้องเรียน', 'กิจกรรม', 'ปีการศึกษา', 'คะแนน', 'ชั่วโมง', 'เวลาเช็กชื่อ'];
  const rows = currentRows.map((r) => [
    r.student_code,
    r.full_name,
    r.class_name,
    r.activity_name,
    r.academic_year,
    r.score,
    r.hours_earned,
    r.check_in_time ? new Date(r.check_in_time).toLocaleString('th-TH') : '-',
  ]);
  return { columns, rows };
}

applyBtn?.addEventListener('click', loadReport);

exportPdfBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToPdf('รายงานคะแนน/ชั่วโมงกิจกรรม', columns, rows, `score-hours-report-${Date.now()}.pdf`);
});

exportExcelBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToExcel('คะแนน-ชั่วโมง', columns, rows, `score-hours-report-${Date.now()}.xlsx`);
});

exportCsvBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToCsv(columns, rows, `score-hours-report-${Date.now()}.csv`);
});

init();