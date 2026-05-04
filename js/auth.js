// ══════════════════════════════════════════════════════════
//   ORI STUDENT PORTAL — AUTH MODULE
// ══════════════════════════════════════════════════════════

const Auth = (() => {
  const STORAGE_KEY = 'ori_portal_user';

  function save(userData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  }

  function get() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function isLoggedIn() {
    return !!get();
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  function getMaHV() {
    const user = get();
    return user ? user.MaHV : null;
  }

  function getHoTen() {
    const user = get();
    return user ? user.HoTen : '';
  }

  function getMaGioiThieu() {
    const user = get();
    return user ? user.MaGioiThieu : '';
  }

  function logout() {
    clear();
    window.location.href = 'index.html';
  }

  return { save, get, clear, isLoggedIn, requireAuth, getMaHV, getHoTen, getMaGioiThieu, logout };
})();
