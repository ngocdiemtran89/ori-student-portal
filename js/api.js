// ══════════════════════════════════════════════════════════
//   ORI STUDENT PORTAL — API MODULE
//   Handles all communication with Google Apps Script
// ══════════════════════════════════════════════════════════

const API = (() => {
  // ⚠️ THAY ĐỔI SAU KHI DEPLOY APPS SCRIPT
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbyaqbx5uPBX2A01ivqu6M1rZTtSJAvCP8qNqq2pu17dyjwpee0wBHBV24HtRdRxDbpc/exec';

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

    // ── Learning History ──
    getHistory(maHV) {
      return request('GET', { action: 'history', maHV });
    },

    // ── Referral ──
    getReferralStats(maHV) {
      return request('GET', { action: 'referral', maHV });
    },

    // ── Leaderboard ──
    getLeaderboard() {
      return request('GET', { action: 'leaderboard' });
    },

    // ── Courses ──
    getCourses() {
      return request('GET', { action: 'courses' });
    },

    // ── Test ──
    test() {
      return request('GET', { action: 'test' });
    },

    // ── Admin ──
    adminListStudents() {
      return request('POST', { action: 'admin_list_students' });
    },
    adminAddStudent(data) {
      return request('POST', { action: 'admin_add_student', ...data });
    },
    adminAddHistory(data) {
      return request('POST', { action: 'admin_add_history', ...data });
    },
    adminUpdateCommission(rowIndex, status) {
      return request('POST', { action: 'admin_update_commission', rowIndex, status });
    },
  };
})();
