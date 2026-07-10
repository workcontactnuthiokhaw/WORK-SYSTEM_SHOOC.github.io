/**
 * scores-hours.js — คะแนน/ชั่วโมงสะสม /pages/student/scores-hours.html
 * สรุปรวมจากทุกกิจกรรมที่ completed + ตารางรายละเอียดต่อกิจกรรม
 *
 * Element IDs ที่คาดหวัง:
 *   #summary-total-hours, #summary-total-score, #summary-total-activities
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

let currentProfile = null;

const loadingState = document.getElementById('loading-state');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');

async function init() {
  currentProfile = await requireAuth(['student']);
  if (!currentProfile) return;
  await loadScoresHours();
}

async function loadScoresHours() {
  loadingState?.classList.remove('is-hidden');

  const { data, error } = await supabaseClient
    .from('attendance')
    .select('*,activities(name,start_datetime,activity_types(name))', {
      filters: [
        ['student_id', 'eq', currentProfile.id],
        ['status', 'eq', 'completed'],
      ],
      order: 'updated_at.desc',
    });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลคะแนน/ชั่วโมงสะสมได้');
    return;
  }

  const rows = data || [];
  renderSummary(rows);
  renderTable(rows);
}

function renderSummary(rows) {
  const totalHours = rows.reduce((sum, r) => sum + (Number(r.hours_earned) || 0), 0);
  const totalScore = rows.reduce((sum, r) => sum + (Number(r.score) || 0), 0);

  setText('summary-total-hours', totalHours.toLocaleString('th-TH'));
  setText('summary-total-score', totalScore.toLocaleString('th-TH'));
  setText('summary-total-activities', rows.length.toLocaleString('th-TH'));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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
      <td>${escapeHtml(r.activities?.name || '-')}</td>
      <td class="cell-muted">${escapeHtml(r.activities?.activity_types?.name || '-')}</td>
      <td class="cell-muted">${r.activities ? new Date(r.activities.start_datetime).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-'}</td>
      <td>${r.score ?? 0}</td>
      <td>${r.hours_earned ?? 0}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

init();