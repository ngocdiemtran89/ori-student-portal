// ══════════════════════════════════════════════════════════
//   ORI STUDENT PORTAL — API MODULE
//   Handles all communication with Google Apps Script
// ══════════════════════════════════════════════════════════

const API = (() => {
  // ⚠️ THAY ĐỔI SAU KHI DEPLOY APPS SCRIPT
  const BASE_URL = 'ĐIỀN_WEB_APP_URL_VÀO_ĐÂY';

  async function request(method, params = {}) {
    try {
      let url, options;

      if (method === 'POST') {
        url = BASE_URL;
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(params),
        };
      } else {
        const query = new URLSearchParams(params).toString();
        url = `${BASE_URL}?${query}`;
        options = { method: 'GET' };
      }

      const resp = await fetch(url, options);
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
  };
})();
