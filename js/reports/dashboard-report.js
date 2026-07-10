/**
 * dashboard-report.js — หน้า Dashboard สรุปข้อมูล /pages/reports/dashboard-report.html
 * เข้าถึงได้ทุก role (แต่ตัวเลขที่เห็นจะถูกจำกัดตาม RLS อัตโนมัติ เช่น ครู/นักเรียนจะเห็นเฉพาะที่เกี่ยวข้อง)
 *
 * กราฟใช้ CSS bar ธรรมดา (ไม่พึ่ง library ภายนอก) เพื่อให้ตรงตามกติกา "ไม่ใช้ framework"
 *
 * Element IDs ที่คาดหวัง:
 *   #card-total-activities, #card-today-activities, #card-total-students,
 *   #card-attended-students, #card-total-hours, #card-total-score
 *   #monthly-chart-bars, #type-chart-legend
 *   #recent-activities-list, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  await loadDashboard();
}

async function loadDashboard() {
  loadingState?.classList.remove('is-hidden');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [activitiesRes, attendanceRes, studentsRes, typesRes] = await Promise.all([
    supabaseClient.from('activities').select('id,name,status,start_datetime,activity_type_id,created_at', { order: 'created_at.desc' }),
    supabaseClient.from('attendance').select('status,score,hours_earned'),
    supabaseClient.from('students').select('id'),
    supabaseClient.from('activity_types').select('id,name'),
  ]);

  loadingState?.classList.add('is-hidden');

  if (activitiesRes.error || attendanceRes.error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูล Dashboard ได้');
    return;
  }

  const activities = activitiesRes.data || [];
  const attendance = attendanceRes.data || [];
  const students = studentsRes.data || [];
  const types = typesRes.data || [];

  // ---------- Summary cards ----------
  const todayCount = activities.filter((a) => {
    const start = new Date(a.start_datetime);
    return start >= todayStart && start <= todayEnd;
  }).length;

  const completedAttendance = attendance.filter((a) => a.status === 'completed');
  const totalHours = completedAttendance.reduce((sum, a) => sum + (Number(a.hours_earned) || 0), 0);
  const totalScore = completedAttendance.reduce((sum, a) => sum + (Number(a.score) || 0), 0);

  setText('card-total-activities', activities.length);
  setText('card-today-activities', todayCount);
  setText('card-total-students', students.length);
  setText('card-attended-students', completedAttendance.length);
  setText('card-total-hours', totalHours.toLocaleString('th-TH'));
  setText('card-total-score', totalScore.toLocaleString('th-TH'));

  renderMonthlyChart(activities);
  renderTypeChart(activities, types);
  renderRecentActivities(activities.slice(0, 8));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/** กราฟแท่งจำนวนกิจกรรมรายเดือน ย้อนหลัง 6 เดือน (วาดด้วย div ธรรมดา ไม่ใช้ library) */
function renderMonthlyChart(activities) {
  const container = document.getElementById('monthly-chart-bars');
  if (!container) return;
  container.innerHTML = '';

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('th-TH', { month: 'short' }), count: 0 });
  }

  activities.forEach((a) => {
    const d = new Date(a.start_datetime);
    const m = months.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
    if (m) m.count += 1;
  });

  const maxCount = Math.max(...months.map((m) => m.count), 1);

  months.forEach((m) => {
    const barWrap = document.createElement('div');
    barWrap.className = 'monthly-bar-wrap';
    barWrap.innerHTML = `
      <div class="monthly-bar-track">
        <div class="monthly-bar-fill" style="height:${(m.count / maxCount) * 100}%"></div>
      </div>
      <div class="monthly-bar-value">${m.count}</div>
      <div class="monthly-bar-label">${m.label}</div>
    `;
    container.appendChild(barWrap);
  });
}

/** กราฟสัดส่วนประเภทกิจกรรม แสดงเป็น legend + horizontal bar */
function renderTypeChart(activities, types) {
  const container = document.getElementById('type-chart-legend');
  if (!container) return;
  container.innerHTML = '';

  const counts = types.map((t) => ({
    name: t.name,
    count: activities.filter((a) => a.activity_type_id === t.id).length,
  })).filter((t) => t.count > 0).sort((a, b) => b.count - a.count);

  const total = counts.reduce((sum, t) => sum + t.count, 0) || 1;
  const colors = ['#C8102E', '#2563EB', '#16A34A', '#D97706', '#7A0A1C', '#9CA3AF'];

  counts.forEach((t, index) => {
    const percent = ((t.count / total) * 100).toFixed(1);
    const row = document.createElement('div');
    row.className = 'type-chart-row';
    row.innerHTML = `
      <div class="type-chart-row-label">
        <span class="dot" style="background:${colors[index % colors.length]}"></span>
        ${escapeHtml(t.name)}
      </div>
      <div class="type-chart-row-track">
        <div class="type-chart-row-fill" style="width:${percent}%; background:${colors[index % colors.length]}"></div>
      </div>
      <div class="type-chart-row-value">${t.count} (${percent}%)</div>
    `;
    container.appendChild(row);
  });

  if (counts.length === 0) {
    container.innerHTML = '<p class="text-muted text-small">ยังไม่มีข้อมูลกิจกรรม</p>';
  }
}

function renderRecentActivities(activities) {
  const container = document.getElementById('recent-activities-list');
  if (!container) return;
  container.innerHTML = '';

  if (activities.length === 0) {
    container.innerHTML = '<p class="text-muted text-small">ยังไม่มีกิจกรรม</p>';
    return;
  }

  activities.forEach((a) => {
    const item = document.createElement('div');
    item.className = 'recent-activity-item';
    item.innerHTML = `
      <div class="recent-activity-icon"><i class="fi fi-rr-calendar-star"></i></div>
      <div>
        <div class="recent-activity-title">${escapeHtml(a.name)}</div>
        <div class="recent-activity-time">${new Date(a.start_datetime).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</div>
      </div>
      <span class="badge badge-${a.status}" style="margin-left:auto">${statusLabel(a.status)}</span>
    `;
    container.appendChild(item);
  });
}

function statusLabel(status) {
  const labels = {
    draft: 'ร่าง', published: 'เผยแพร่แล้ว', registration_open: 'เปิดลงทะเบียน',
    registration_closed: 'ปิดลงทะเบียน', ongoing: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
  };
  return labels[status] || status;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

init();