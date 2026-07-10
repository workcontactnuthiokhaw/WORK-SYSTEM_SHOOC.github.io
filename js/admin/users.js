/**
 * users.js — จัดการผู้ใช้งาน /pages/admin/users.html
 *
 * ⚠️ ข้อจำกัดสำคัญที่ต้องเข้าใจก่อนใช้ไฟล์นี้:
 * 1) ตาราง `profiles` ไม่มีคอลัมน์ email (email อยู่ใน auth.users ซึ่ง anon key
 *    เข้าถึงไม่ได้โดยตรงผ่าน PostgREST) หน้านี้จึงแสดง ชื่อ/role/รหัสนักเรียน-ครู
 *    เป็นหลัก ถ้าต้องการแสดง email ด้วย ให้สร้าง Postgres VIEW ที่ join กับ
 *    auth.users แบบ security definer แล้ว query จาก view นั้นแทน
 *
 * 2) การ "สร้าง auth user ใหม่" (ผูก email/password) ต้องใช้ service_role key
 *    ซึ่งห้ามฝังฝั่ง client เด็ดขาด ฟังก์ชัน createNewUser() ด้านล่างจึงเรียกไปยัง
 *    Supabase Edge Function ที่ชื่อ `admin-create-user` (ต้องสร้างแยกต่างหาก
 *    ฝั่งเซิร์ฟเวอร์ด้วย service_role key) ถ้ายังไม่ได้ deploy Edge Function
 *    ปุ่มนี้จะแจ้ง error ให้ทราบ พร้อมแนะนำให้สร้าง user ผ่าน Supabase Dashboard
 *    ไปก่อน (Authentication -> Users -> Add user) แล้วค่อยมาเพิ่มแถวใน
 *    profiles/students/teachers จากฟอร์มนี้
 *
 * Element IDs ที่คาดหวัง:
 *   #user-form, #user-id (hidden, = profiles.id)
 *   #user-email (ใช้ตอนสร้างใหม่เท่านั้น), #user-password (ใช้ตอนสร้างใหม่เท่านั้น)
 *   #user-full-name, #user-role (select: admin/teacher/student)
 *   #student-fields (wrapper), #student-code, #student-class (select)
 *   #teacher-fields (wrapper), #teacher-code, #teacher-department (select)
 *   #form-submit-btn, #form-reset-btn, #search-input, #filter-role
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

let allProfiles = [];
let allStudents = [];
let allTeachers = [];
let allClasses = [];
let allDepartments = [];
let mergedUsers = [];

const form = document.getElementById('user-form');
const idInput = document.getElementById('user-id');
const emailInput = document.getElementById('user-email');
const passwordInput = document.getElementById('user-password');
const fullNameInput = document.getElementById('user-full-name');
const roleSelect = document.getElementById('user-role');
const studentFields = document.getElementById('student-fields');
const studentCodeInput = document.getElementById('student-code');
const studentClassSelect = document.getElementById('student-class');
const teacherFields = document.getElementById('teacher-fields');
const teacherCodeInput = document.getElementById('teacher-code');
const teacherDepartmentSelect = document.getElementById('teacher-department');
const submitBtn = document.getElementById('form-submit-btn');
const resetBtn = document.getElementById('form-reset-btn');
const searchInput = document.getElementById('search-input');
const filterRole = document.getElementById('filter-role');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth(['admin']);
  if (!profile) return;
  await loadLookups();
  await loadUsers();
  toggleRoleFields();
}

async function loadLookups() {
  const [classRes, deptRes] = await Promise.all([
    supabaseClient.from('classes').select('id,class_name', { order: 'class_name.asc' }),
    supabaseClient.from('departments').select('id,name', { order: 'name.asc' }),
  ]);
  allClasses = classRes.data || [];
  allDepartments = deptRes.data || [];

  if (studentClassSelect) {
    studentClassSelect.innerHTML = '<option value="">เลือกห้องเรียน</option>';
    allClasses.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.class_name;
      studentClassSelect.appendChild(opt);
    });
  }
  if (teacherDepartmentSelect) {
    teacherDepartmentSelect.innerHTML = '<option value="">เลือกภาควิชา/แผนก</option>';
    allDepartments.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      teacherDepartmentSelect.appendChild(opt);
    });
  }
}

async function loadUsers() {
  loadingState?.classList.remove('is-hidden');

  const [profileRes, studentRes, teacherRes] = await Promise.all([
    supabaseClient.from('profiles').select('*', { order: 'full_name.asc' }),
    supabaseClient.from('students').select('*'),
    supabaseClient.from('teachers').select('*'),
  ]);

  loadingState?.classList.add('is-hidden');

  if (profileRes.error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลผู้ใช้งานได้');
    return;
  }

  allProfiles = profileRes.data || [];
  allStudents = studentRes.data || [];
  allTeachers = teacherRes.data || [];

  // รวมข้อมูล profiles + students/teachers เข้าด้วยกันฝั่ง client
  mergedUsers = allProfiles.map((p) => {
    const studentInfo = allStudents.find((s) => s.id === p.id);
    const teacherInfo = allTeachers.find((t) => t.id === p.id);
    const classInfo = studentInfo ? allClasses.find((c) => c.id === studentInfo.class_id) : null;
    const deptInfo = teacherInfo ? allDepartments.find((d) => d.id === teacherInfo.department_id) : null;
    return {
      ...p,
      student_code: studentInfo?.student_code || null,
      class_name: classInfo?.class_name || null,
      teacher_code: teacherInfo?.teacher_code || null,
      department_name: deptInfo?.name || null,
    };
  });

  renderTable(mergedUsers);
}

function renderTable(rows) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((u) => {
    const codeOrDept = u.role === 'student'
      ? `${u.student_code || '-'} ${u.class_name ? `(${u.class_name})` : ''}`
      : u.role === 'teacher'
        ? `${u.teacher_code || '-'} ${u.department_name ? `(${u.department_name})` : ''}`
        : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(u.full_name)}</td>
      <td><span class="role-tag role-${u.role}">${roleLabel(u.role)}</span></td>
      <td class="cell-muted">${escapeHtml(codeOrDept)}</td>
      <td class="cell-actions">
        <button class="btn btn-icon btn-edit" data-id="${u.id}" aria-label="แก้ไข"><i class="fi fi-rr-edit"></i></button>
        <button class="btn btn-icon btn-delete" data-id="${u.id}" aria-label="ลบ"><i class="fi fi-rr-trash"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function roleLabel(role) {
  return { admin: 'ผู้ดูแลระบบ', teacher: 'ครู', student: 'นักเรียน' }[role] || role;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function toggleRoleFields() {
  const role = roleSelect?.value;
  studentFields?.classList.toggle('is-hidden', role !== 'student');
  teacherFields?.classList.toggle('is-hidden', role !== 'teacher');
  // สร้างใหม่เท่านั้นถึงจะกรอก email/password ได้ (แก้ไขจะล็อกไว้)
}

function resetForm() {
  form?.reset();
  idInput.value = '';
  emailInput.disabled = false;
  passwordInput.disabled = false;
  document.getElementById('create-only-fields')?.classList.remove('is-hidden');
  submitBtn.textContent = 'เพิ่มผู้ใช้งาน';
  toggleRoleFields();
}

roleSelect?.addEventListener('change', toggleRoleFields);
resetBtn?.addEventListener('click', resetForm);

/**
 * เรียก Edge Function เพื่อสร้าง auth user ใหม่ (ต้อง deploy แยกต่างหาก)
 * Edge Function ควรทำ: รับ email/password -> เรียก supabase.auth.admin.createUser()
 * ด้วย service_role key ฝั่งเซิร์ฟเวอร์ -> คืนค่า { id } ของ user ที่สร้างสำเร็จ
 */
async function createAuthUserViaEdgeFunction(email, password) {
  try {
    const res = await fetch(`${supabaseClient.url}/functions/v1/admin-create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Edge Function ยังไม่ได้ตั้งค่า หรือสร้างผู้ใช้ไม่สำเร็จ');
    const data = await res.json();
    return { id: data.id, error: null };
  } catch (err) {
    return { id: null, error: 'ยังไม่ได้ตั้งค่าระบบสร้างผู้ใช้ใหม่อัตโนมัติ (Edge Function) กรุณาสร้างบัญชีผ่าน Supabase Dashboard -> Authentication -> Users ก่อน แล้วค่อยกลับมากรอกข้อมูลเพิ่มเติมที่นี่โดยใช้ UID ที่ได้' };
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const editingId = idInput.value;
  const fullName = fullNameInput.value.trim();
  const role = roleSelect.value;

  if (!fullName || !role) {
    Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อ-สกุล และเลือก role ให้ครบ');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add('is-loading');

  let userId = editingId;

  // ---------- กรณีสร้างใหม่: ต้องสร้าง auth user ก่อน ----------
  if (!editingId) {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกอีเมลและรหัสผ่านสำหรับบัญชีใหม่');
      return;
    }

    const { id, error: createError } = await createAuthUserViaEdgeFunction(email, password);
    if (createError) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      Popup.error('สร้างผู้ใช้ไม่สำเร็จ', createError);
      return;
    }
    userId = id;

    const { error: profileInsertError } = await supabaseClient
      .from('profiles')
      .insert({ id: userId, full_name: fullName, role });

    if (profileInsertError) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      Popup.error('บันทึกโปรไฟล์ไม่สำเร็จ', 'สร้างบัญชี auth แล้วแต่บันทึกข้อมูล profile ไม่สำเร็จ');
      return;
    }
  } else {
    // ---------- กรณีแก้ไข: อัปเดตชื่อ/role ----------
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ full_name: fullName, role }, [['id', 'eq', editingId]]);

    if (updateError) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      Popup.error('บันทึกไม่สำเร็จ', 'ไม่สามารถแก้ไขข้อมูลผู้ใช้ได้');
      return;
    }
  }

  // ---------- บันทึกข้อมูลเฉพาะ role (students / teachers) ----------
  if (role === 'student') {
    const payload = {
      id: userId,
      student_code: studentCodeInput.value.trim(),
      class_id: studentClassSelect.value || null,
    };
    await supabaseClient.from('teachers').delete([['id', 'eq', userId]]); // เผื่อเปลี่ยน role มาจากครู
    const exists = allStudents.find((s) => s.id === userId);
    if (exists) {
      await supabaseClient.from('students').update(payload, [['id', 'eq', userId]]);
    } else {
      await supabaseClient.from('students').insert(payload);
    }
  } else if (role === 'teacher') {
    const payload = {
      id: userId,
      teacher_code: teacherCodeInput.value.trim(),
      department_id: teacherDepartmentSelect.value || null,
    };
    await supabaseClient.from('students').delete([['id', 'eq', userId]]); // เผื่อเปลี่ยน role มาจากนักเรียน
    const exists = allTeachers.find((t) => t.id === userId);
    if (exists) {
      await supabaseClient.from('teachers').update(payload, [['id', 'eq', userId]]);
    } else {
      await supabaseClient.from('teachers').insert(payload);
    }
  } else {
    // role = admin: ไม่ต้องมีแถวใน students/teachers ลบทิ้งถ้ามีของเดิม (กรณีเปลี่ยน role มาเป็น admin)
    await supabaseClient.from('students').delete([['id', 'eq', userId]]);
    await supabaseClient.from('teachers').delete([['id', 'eq', userId]]);
  }

  submitBtn.disabled = false;
  submitBtn.classList.remove('is-loading');

  Popup.toast('success', editingId ? 'แก้ไขผู้ใช้งานสำเร็จ' : 'เพิ่มผู้ใช้งานสำเร็จ');
  resetForm();
  await loadUsers();
});

tableBody?.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.btn-edit');
  const deleteBtn = e.target.closest('.btn-delete');

  if (editBtn) {
    const u = mergedUsers.find((x) => x.id === editBtn.dataset.id);
    if (!u) return;
    idInput.value = u.id;
    fullNameInput.value = u.full_name;
    roleSelect.value = u.role;
    emailInput.disabled = true;
    passwordInput.disabled = true;
    document.getElementById('create-only-fields')?.classList.add('is-hidden');
    toggleRoleFields();

    if (u.role === 'student') {
      studentCodeInput.value = u.student_code || '';
      const studentRow = allStudents.find((s) => s.id === u.id);
      studentClassSelect.value = studentRow?.class_id || '';
    }
    if (u.role === 'teacher') {
      teacherCodeInput.value = u.teacher_code || '';
      const teacherRow = allTeachers.find((t) => t.id === u.id);
      teacherDepartmentSelect.value = teacherRow?.department_id || '';
    }

    submitBtn.textContent = 'บันทึกการแก้ไข';
    fullNameInput.focus();
  }

  if (deleteBtn) {
    const confirmed = await Popup.confirm(
      'ลบผู้ใช้งาน',
      'การลบจะลบข้อมูล profile ในระบบ (รวมถึงข้อมูลนักเรียน/ครูที่ผูกอยู่) แต่จะไม่ลบบัญชี login ใน Supabase Auth โดยอัตโนมัติ ต้องไปลบเพิ่มที่ Dashboard -> Authentication -> Users ด้วย ต้องการดำเนินการต่อหรือไม่?'
    );
    if (!confirmed) return;

    const { error } = await supabaseClient.from('profiles').delete([['id', 'eq', deleteBtn.dataset.id]]);
    if (error) {
      Popup.error('ลบไม่สำเร็จ', 'เกิดข้อผิดพลาดในการลบข้อมูลผู้ใช้');
      return;
    }
    Popup.toast('success', 'ลบผู้ใช้งานสำเร็จ (อย่าลืมลบบัญชีใน Supabase Auth ด้วย)');
    await loadUsers();
  }
});

function applyFilters() {
  const keyword = (searchInput?.value || '').trim().toLowerCase();
  const roleFilter = filterRole?.value || '';
  const filtered = mergedUsers.filter((u) => {
    const matchKeyword = u.full_name.toLowerCase().includes(keyword);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchKeyword && matchRole;
  });
  renderTable(filtered);
}

searchInput?.addEventListener('input', applyFilters);
filterRole?.addEventListener('change', applyFilters);

init();