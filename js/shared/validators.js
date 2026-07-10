/**
 * validators.js — ฟังก์ชันกลางสำหรับ validate ฟอร์ม ใช้ร่วมกันทุกหน้า
 * ทุกฟังก์ชันคืนค่า string ข้อความ error (ถ้าผ่านจะคืน '' ว่างเปล่า)
 *
 * วิธีใช้:
 *   const err = isRequired(nameInput.value, 'กรุณากรอกชื่อ');
 *   if (err) { Popup.warning('ข้อมูลไม่ครบถ้วน', err); return; }
 *
 *   const errors = validateFields([
 *     [isRequired, email, 'กรุณากรอกอีเมล'],
 *     [isValidEmail, email, 'รูปแบบอีเมลไม่ถูกต้อง'],
 *   ]);
 */

export function isRequired(value, message = 'กรุณากรอกข้อมูลนี้') {
  const isEmpty = value === null || value === undefined || String(value).trim() === '';
  return isEmpty ? message : '';
}

export function isValidEmail(value, message = 'รูปแบบอีเมลไม่ถูกต้อง') {
  if (!value) return '';
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(value) ? '' : message;
}

export function minLength(value, min, message) {
  if (!value) return '';
  return String(value).length < min ? (message || `ต้องมีอย่างน้อย ${min} ตัวอักษร`) : '';
}

export function maxLength(value, max, message) {
  if (!value) return '';
  return String(value).length > max ? (message || `ต้องไม่เกิน ${max} ตัวอักษร`) : '';
}

export function isNumeric(value, message = 'กรุณากรอกตัวเลขเท่านั้น') {
  if (value === '' || value === null || value === undefined) return '';
  return isNaN(Number(value)) ? message : '';
}

export function isPositiveNumber(value, message = 'ต้องเป็นจำนวนมากกว่า 0') {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  return isNaN(num) || num <= 0 ? message : '';
}

export function isValidDateRange(startDate, endDate, message = 'วันที่สิ้นสุดต้องมาหลังวันที่เริ่มต้น') {
  if (!startDate || !endDate) return '';
  return new Date(endDate) < new Date(startDate) ? message : '';
}

export function isFutureDate(dateValue, message = 'วันที่ต้องเป็นวันในอนาคต') {
  if (!dateValue) return '';
  return new Date(dateValue) < new Date() ? message : '';
}

export function passwordsMatch(password, confirmPassword, message = 'รหัสผ่านไม่ตรงกัน') {
  return password === confirmPassword ? '' : message;
}

/**
 * ตรวจสอบหลายเงื่อนไขพร้อมกัน คืนค่า array ของ error message แรกที่พบต่อ field
 * @param {Array<[fn, value, ...args, message]>} rules
 * @returns {string[]} รายการ error ที่ไม่ว่าง (ถ้าไม่มี error จะคืน array ว่าง)
 */
export function validateFields(rules) {
  const errors = [];
  for (const rule of rules) {
    const [fn, ...args] = rule;
    const error = fn(...args);
    if (error) errors.push(error);
  }
  return errors;
}