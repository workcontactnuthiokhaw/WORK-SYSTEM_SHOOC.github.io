/**
 * supabase-client.js
 * จุดเชื่อมต่อ Supabase เดียวของทั้งระบบ (ตามกติกาโปรเจกต์: ห้ามฝัง key กระจายหลายที่)
 *
 * ตามข้อกำหนด "ใช้ Fetch API + Async/Await ในการเรียก Supabase ทั้งหมด"
 * ไฟล์นี้จึงไม่ใช้ @supabase/supabase-js SDK แต่ห่อ Fetch ไปยัง
 * PostgREST (ตาราง), GoTrue (Auth), และ Storage REST API ของ Supabase โดยตรง
 *
 * *** แก้ไข SUPABASE_URL และ SUPABASE_ANON_KEY ด้านล่างเป็นค่าจริงของโปรเจกต์คุณ ***
 */

const SUPABASE_URL = 'https://gabjjnpnuxoqfjvnybpc.supabase.co'; // TODO: แทนที่ด้วย Project URL จริง
const SUPABASE_ANON_KEY = 'sb_publishable_nHM7zjMrzm2hTKtNttNtNQ_wL8eiPbe';             // TODO: แทนที่ด้วย anon public key จริง

const AUTH_STORAGE_KEY = 'sams_auth_session';

// ---------------------------------------------------------------
// Session persistence (เก็บ session ไว้ใน localStorage ของฝั่ง browser)
// ---------------------------------------------------------------
function saveSession(session) {
  if (session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function loadSession() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getAccessToken() {
  const session = loadSession();
  return session?.access_token || null;
}

// ---------------------------------------------------------------
// Auth (GoTrue REST API: /auth/v1/...)
// ---------------------------------------------------------------
const auth = {
  /** เข้าสู่ระบบด้วย email/password คืนค่า { data, error } */
  async signInWithPassword(email, password) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { data: null, error: { message: data.error_description || data.msg || 'เข้าสู่ระบบไม่สำเร็จ' } };
      }
      saveSession(data);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' } };
    }
  },

  /** ออกจากระบบ */
  async signOut() {
    const token = getAccessToken();
    try {
      if (token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } finally {
      saveSession(null);
    }
    return { error: null };
  },

  /** ส่งอีเมลรีเซ็ตรหัสผ่าน */
  async resetPasswordForEmail(email, redirectTo) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, gotrue_meta_security: {}, redirect_to: redirectTo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: { message: data.msg || 'ส่งอีเมลรีเซ็ตรหัสผ่านไม่สำเร็จ' } };
      }
      return { error: null };
    } catch {
      return { error: { message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' } };
    }
  },

  /** ตั้งรหัสผ่านใหม่ (ต้อง login ผ่าน recovery link แล้วมี access_token อยู่แล้ว) */
  async updatePassword(newPassword) {
    const token = getAccessToken();
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: { message: data.msg || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' } };
      }
      return { error: null };
    } catch {
      return { error: { message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' } };
    }
  },

  /** คืนค่า session ปัจจุบัน (null ถ้ายังไม่ login) */
  getSession() {
    return loadSession();
  },

  /** ดึงข้อมูล user ปัจจุบันจาก token (เช็คว่า token ยังใช้ได้จริงไหม) */
  async getUser() {
    const token = getAccessToken();
    if (!token) return { data: null, error: { message: 'ไม่มี session' } };
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: null, error: { message: 'session หมดอายุ' } };
      const data = await res.json();
      return { data, error: null };
    } catch {
      return { data: null, error: { message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' } };
    }
  },
};

// ---------------------------------------------------------------
// Database (PostgREST API: /rest/v1/<table>)
// Query builder แบบง่าย รองรับ select / insert / update / delete / filter / order / limit
// ---------------------------------------------------------------
function from(table) {
  const base = `${SUPABASE_URL}/rest/v1/${table}`;

  function authHeaders(extra = {}) {
    const token = getAccessToken();
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      ...extra,
    };
  }

  return {
    /**
     * ดึงข้อมูล
     * @param {string} columns - เช่น '*' หรือ 'id,name,status'
     * @param {object} options - { filters: [['status','eq','active']], order: 'created_at.desc', limit, offset }
     */
    async select(columns = '*', options = {}) {
      const params = new URLSearchParams();
      params.set('select', columns);
      (options.filters || []).forEach(([col, op, val]) => params.append(col, `${op}.${val}`));
      if (options.order) params.set('order', options.order);
      if (options.limit) params.set('limit', options.limit);
      if (options.offset) params.set('offset', options.offset);

      try {
        const res = await fetch(`${base}?${params.toString()}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) return { data: null, error: data, count: 0 };
        return { data, error: null };
      } catch (err) {
        return { data: null, error: { message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' } };
      }
    },

    /** เพิ่มข้อมูลใหม่ (row เดียวหรือ array ก็ได้) */
    async insert(payload) {
      try {
        const res = await fetch(base, {
          method: 'POST',
          headers: authHeaders({
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          }),
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) return { data: null, error: data };
        return { data, error: null };
      } catch {
        return { data: null, error: { message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' } };
      }
    },

    /** แก้ไขข้อมูล ระบุเงื่อนไขผ่าน filters เช่น [['id','eq', someId]] */
    async update(payload, filters = []) {
      const params = new URLSearchParams();
      filters.forEach(([col, op, val]) => params.append(col, `${op}.${val}`));
      try {
        const res = await fetch(`${base}?${params.toString()}`, {
          method: 'PATCH',
          headers: authHeaders({
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          }),
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) return { data: null, error: data };
        return { data, error: null };
      } catch {
        return { data: null, error: { message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' } };
      }
    },

    /** ลบข้อมูล ระบุเงื่อนไขผ่าน filters */
    async delete(filters = []) {
      const params = new URLSearchParams();
      filters.forEach(([col, op, val]) => params.append(col, `${op}.${val}`));
      try {
        const res = await fetch(`${base}?${params.toString()}`, {
          method: 'DELETE',
          headers: authHeaders({ Prefer: 'return=representation' }),
        });
        const data = await res.json();
        if (!res.ok) return { data: null, error: data };
        return { data, error: null };
      } catch {
        return { data: null, error: { message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' } };
      }
    },
  };
}

// ---------------------------------------------------------------
// Storage (Storage REST API: /storage/v1/object/...)
// ---------------------------------------------------------------
const storage = {
  /** อัปโหลดไฟล์เข้า bucket เช่น upload('certificates', `${studentId}/cert-001.pdf`, fileBlob) */
  async upload(bucket, path, file) {
    const token = getAccessToken();
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
        },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: data };
      return { data, error: null };
    } catch {
      return { data: null, error: { message: 'อัปโหลดไฟล์ไม่สำเร็จ' } };
    }
  },

  /** URL สาธารณะ (ใช้กับ bucket public เช่น assets) */
  getPublicUrl(bucket, path) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },

  /** ขอ signed URL ชั่วคราว (ใช้กับ bucket private เช่น certificates) */
  async createSignedUrl(bucket, path, expiresInSeconds = 3600) {
    const token = getAccessToken();
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: data };
      return { data: { signedUrl: `${SUPABASE_URL}/storage/v1${data.signedURL}` }, error: null };
    } catch {
      return { data: null, error: { message: 'สร้าง signed URL ไม่สำเร็จ' } };
    }
  },
};

const supabaseClient = { auth, from, storage, url: SUPABASE_URL };

export default supabaseClient;