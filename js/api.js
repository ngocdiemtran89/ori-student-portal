// ══════════════════════════════════════════════════════════
//   ORI STUDENT PORTAL — API MODULE
//   Handles all communication with Google Apps Script
// ══════════════════════════════════════════════════════════

const API = (() => {
  // ⚠️ THAY ĐỔI SAU KHI DEPLOY APPS SCRIPT
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbwYMBpdVh6ft3xiTEHlEMWJD5ccL_lSfYTHtkAQB_5xfMHwxUyQO209m8hnmVtRIg85/exec';

  async function request(method, params = {}) {
    try {
      let url;

      if (method === 'POST') {
        // Google Apps Script redirect POST→GET gây lỗi
        // Giải pháp: gửi qua GET với param 'payload'
        const payload = encodeURIComponent(JSON.stringify(params));
        url = `${BASE_URL}?action=${params.action || ''}&payload=${payload}`;
      } else {
        const query = new URLSearchParams(params).toString();
        url = `${BASE_URL}?${query}`;
      }

      const resp = await fetch(url, { method: 'GET', redirect: 'follow' });
      const data = await resp.json();
      return data;
    } catch (err) {
      console.error('API Error:', err);
      return { ok: false, error: 'Không thể kết nối đến server. Vui lòng thử lại.' };
    }
  }

  return {
    // ── Auth ──
    login(hoTen, sdt) {
      return request('POST', { action: 'login', hoTen, sdt });
    },

    // ── Profile ──
    getProfile(maHV) {
      return request('GET', { action: 'profile', maHV });
    },
    updateProfile(data) {
      return request('POST', { action: 'update_profile', ...data });
    },

    // ── Learning History ──
    getHistory(maHV) {
      return request('GET', { action: 'history', maHV });
    },

    // ── Referral ──
    getReferralStats(maHV) {
      return request('GET', { action: 'referral', maHV });
    },
    requestWithdrawal(maHV) {
      return request('POST', { action: 'request_withdrawal', maHV });
    },

    // ── Leaderboard ──
    getLeaderboard() {
      return request('GET', { action: 'leaderboard' });
    },

    // ── Courses ──
    getCourses() {
      return request('GET', { action: 'courses' });
    },

    // ── Registration ──
    register(data) {
      return request('POST', { action: 'register', ...data });
    },

    // ── Test ──
    test() {
      return request('GET', { action: 'test' });
    },

    // ── Public ──
    lookupRef(refCode) {
      return request('GET', { action: 'lookup_ref', ref: refCode });
    },

    // ── Admin (protected by secret) ──
    adminListStudents() {
      return request('POST', { action: 'admin_list_students', secret: API.getSecret() });
    },
    adminListWithdrawals() {
      return request('POST', { action: 'admin_list_withdrawals', secret: API.getSecret() });
    },
    adminAddStudent(data) {
      return request('POST', { action: 'admin_add_student', secret: API.getSecret(), ...data });
    },
    adminAddHistory(data) {
      return request('POST', { action: 'admin_add_history', secret: API.getSecret(), ...data });
    },
    adminUpdateCommission(rowIndex, status) {
      return request('POST', { action: 'admin_update_commission', secret: API.getSecret(), rowIndex, status });
    },

    // Secret management
    getSecret() {
      return localStorage.getItem('ori_admin_secret') || '';
    },
    setSecret(s) {
      localStorage.setItem('ori_admin_secret', s);
    },
  };
})();
