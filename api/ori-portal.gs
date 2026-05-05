// ╔══════════════════════════════════════════════════════════╗
// ║       ORI STUDENT PORTAL — GOOGLE APPS SCRIPT API       ║
// ║  Backend xử lý: Login, Profile, Referral, Courses, etc. ║
// ╚══════════════════════════════════════════════════════════╝

// ── CẤU HÌNH ──
const SHEET_ID = '1fMv_ckTvJTwOiAjiCIzdQx7oobwbJyx_oeeDUnI8VWI';

const SH = {
  HOC_VIEN   : 'HocVien',
  LICH_SU    : 'LichSuHoc',
  GIOI_THIEU : 'GioiThieu',
  KHOA_HOC   : 'KhoaHoc',
};

// ── BẢO MẬT: Lấy API_SECRET từ Script Properties ──
function getApiSecret() {
  return PropertiesService.getScriptProperties().getProperty('API_SECRET') || '';
}

function checkAdminSecret(secret) {
  const stored = getApiSecret();
  if (!stored) return true; // Chưa cài đặt secret → cho qua (dev mode)
  return secret === stored;
}

// ── CORS Headers ──
function createCorsOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET Handler (xử lý cả GET và POST qua param payload) ──
function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  
  // Parse payload nếu có (dành cho login, register, admin actions)
  let body = {};
  if (e.parameter.payload) {
    try {
      body = JSON.parse(decodeURIComponent(e.parameter.payload));
    } catch(err) {
      body = {};
    }
  }
  
  try {
    switch (action) {
      case 'test':
        return createCorsOutput({ ok: true, msg: 'ORI Portal API v3.0 ✅ (Secured)' });
      
      case 'courses':
        return createCorsOutput({ ok: true, data: getCourses() });
      
      case 'profile':
        return createCorsOutput(getProfile(e.parameter.maHV));
      
      case 'history':
        return createCorsOutput({ ok: true, data: getHistory(e.parameter.maHV) });
      
      case 'referral':
        return createCorsOutput(getReferralStats(e.parameter.maHV));
      
      case 'leaderboard':
        return createCorsOutput({ ok: true, data: getLeaderboard() });
      
      // ── Public actions ──
      case 'login':
        return createCorsOutput(handleLogin(body.hoTen, body.sdt));
      
      case 'register':
        return createCorsOutput(handleRegister(body));
      
      case 'lookup_ref':
        return createCorsOutput(lookupRefCode(e.parameter.ref || body.ref));
      
      // ── Admin actions (đòi hỏi secret) ──
      case 'admin_add_student':
      case 'admin_list_students':
      case 'admin_add_history':
      case 'admin_update_commission': {
        if (!checkAdminSecret(body.secret)) {
          return createCorsOutput({ ok: false, error: 'Không có quyền truy cập.' });
        }
        if (action === 'admin_list_students') return createCorsOutput(adminListStudents());
        if (action === 'admin_add_student') return createCorsOutput(handleRegister(body));
        if (action === 'admin_add_history') return createCorsOutput(adminAddHistoryAPI(body));
        if (action === 'admin_update_commission') return createCorsOutput(adminUpdateCommission(body));
      }
      
      default:
        return createCorsOutput({ ok: true, msg: 'ORI Student Portal API' });
    }
  } catch (err) {
    Logger.log('doGet error: ' + err.stack);
    return createCorsOutput({ ok: false, error: err.message });
  }
}

// ── POST Handler ──
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = (body.action || '').toLowerCase();
    
    switch (action) {
      case 'login':
        return createCorsOutput(handleLogin(body.hoTen, body.sdt));
      
      case 'register':
        return createCorsOutput(handleRegister(body));
      
      // ── Admin Actions ──
      case 'admin_list_students':
        return createCorsOutput(adminListStudents());
      
      case 'admin_add_student':
        return createCorsOutput(handleRegister(body));
      
      case 'admin_add_history':
        return createCorsOutput(adminAddHistoryAPI(body));
      
      case 'admin_update_commission':
        return createCorsOutput(adminUpdateCommission(body));
      
      default:
        return createCorsOutput({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    Logger.log('doPost error: ' + err.stack);
    return createCorsOutput({ ok: false, error: err.message });
  }
}

// ══════════════════════════════════════
//          AUTHENTICATION
// ══════════════════════════════════════

function handleLogin(hoTen, sdt) {
  if (!hoTen || !sdt) {
    return { ok: false, error: 'Vui lòng nhập đầy đủ Họ tên và SĐT.' };
  }
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) return { ok: false, error: 'Sheet HocVien không tồn tại.' };
  
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  
  // Tìm cột
  const iHoTen = headers.indexOf('HoTen');
  const iSDT   = headers.indexOf('SDT');
  const iMaHV  = headers.indexOf('MaHV');
  const iTrangThai = headers.indexOf('TrangThai');
  
  if (iHoTen === -1 || iSDT === -1) {
    return { ok: false, error: 'Cấu trúc sheet không đúng.' };
  }
  
  const normalizedName = hoTen.trim().toLowerCase();
  const normalizedPhone = sdt.trim().replace(/\s/g, '');
  
  for (let i = 1; i < rows.length; i++) {
    const rowName  = String(rows[i][iHoTen]).trim().toLowerCase();
    const rowPhone = String(rows[i][iSDT]).trim().replace(/\s/g, '');
    
    // So sánh SĐT: xử lý trường hợp Sheet xóa số 0 đầu (010813 → 10813)
    const phoneMatch = rowPhone === normalizedPhone 
      || rowPhone === normalizedPhone.replace(/^0+/, '') 
      || normalizedPhone === rowPhone.replace(/^0+/, '');
    
    if (rowName === normalizedName && phoneMatch) {
      // Tìm thấy → Trả về profile
      const profile = {};
      headers.forEach((h, idx) => {
        if (h) profile[h] = rows[i][idx];
      });
      
      // Thêm role cho admin
      if (profile.TrangThai === 'Admin') {
        profile.role = 'admin';
      }
      
      // Format dates
      if (profile.NgayVaoHoc instanceof Date) {
        profile.NgayVaoHoc = Utilities.formatDate(profile.NgayVaoHoc, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
      }
      if (profile.NgayTao instanceof Date) {
        profile.NgayTao = Utilities.formatDate(profile.NgayTao, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');
      }
      
      return { ok: true, data: profile };
    }
  }
  
  return { ok: false, error: 'Họ tên hoặc SĐT không đúng. Vui lòng thử lại.' };
}

// ══════════════════════════════════════
//          PROFILE
// ══════════════════════════════════════

function getProfile(maHV) {
  if (!maHV) return { ok: false, error: 'Thiếu mã học viên.' };
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaHV = headers.indexOf('MaHV');
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iMaHV]).trim() === String(maHV).trim()) {
      const profile = {};
      headers.forEach((h, idx) => {
        if (h) {
          let val = rows[i][idx];
          if (val instanceof Date) {
            val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
          }
          profile[h] = val;
        }
      });
      return { ok: true, data: profile };
    }
  }
  
  return { ok: false, error: 'Không tìm thấy học viên.' };
}

// ══════════════════════════════════════
//          LEARNING HISTORY
// ══════════════════════════════════════

function getHistory(maHV) {
  if (!maHV) return [];
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.LICH_SU);
  if (!sh) return [];
  
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaHV = headers.indexOf('MaHV');
  
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iMaHV]).trim() === String(maHV).trim()) {
      const entry = {};
      headers.forEach((h, idx) => {
        if (h) {
          let val = rows[i][idx];
          if (val instanceof Date) {
            val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
          }
          entry[h] = val;
        }
      });
      result.push(entry);
    }
  }
  
  return result;
}

// ══════════════════════════════════════
//          REFERRAL SYSTEM
// ══════════════════════════════════════

function getReferralStats(maHV) {
  if (!maHV) return { ok: false, error: 'Thiếu mã học viên.' };
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Lấy mã giới thiệu của học viên
  const shHV = ss.getSheetByName(SH.HOC_VIEN);
  const hvRows = shHV.getDataRange().getValues();
  const hvHeaders = hvRows[0];
  const iMaHV = hvHeaders.indexOf('MaHV');
  const iMaGT = hvHeaders.indexOf('MaGioiThieu');
  
  let maGioiThieu = '';
  for (let i = 1; i < hvRows.length; i++) {
    if (String(hvRows[i][iMaHV]).trim() === String(maHV).trim()) {
      maGioiThieu = String(hvRows[i][iMaGT]).trim();
      break;
    }
  }
  
  if (!maGioiThieu) {
    return { ok: true, data: { maGioiThieu: '', referrals: [], totalCommission: 0, paidCommission: 0 } };
  }
  
  // Lấy danh sách người đã giới thiệu
  const shGT = ss.getSheetByName(SH.GIOI_THIEU);
  if (!shGT) {
    return { ok: true, data: { maGioiThieu, referrals: [], totalCommission: 0, paidCommission: 0 } };
  }
  
  const gtRows = shGT.getDataRange().getValues();
  const gtHeaders = gtRows[0];
  const iMaGTCol = gtHeaders.indexOf('MaGioiThieu');
  
  const referrals = [];
  let totalCommission = 0;
  let paidCommission = 0;
  
  for (let i = 1; i < gtRows.length; i++) {
    if (String(gtRows[i][iMaGTCol]).trim() === maGioiThieu) {
      const entry = {};
      gtHeaders.forEach((h, idx) => {
        if (h) {
          let val = gtRows[i][idx];
          if (val instanceof Date) {
            val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
          }
          entry[h] = val;
        }
      });
      referrals.push(entry);
      
      const commission = Number(entry['HoaHong_10pct']) || 0;
      totalCommission += commission;
      if (entry['TrangThaiHH'] === 'DaThanhToan') {
        paidCommission += commission;
      }
    }
  }
  
  return {
    ok: true,
    data: {
      maGioiThieu,
      referrals,
      totalCommission,
      paidCommission,
      unpaidCommission: totalCommission - paidCommission,
      totalReferred: referrals.length,
    }
  };
}

// ══════════════════════════════════════
//          LEADERBOARD
// ══════════════════════════════════════

function getLeaderboard() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const shGT = ss.getSheetByName(SH.GIOI_THIEU);
  if (!shGT) return [];
  
  const rows = shGT.getDataRange().getValues();
  const headers = rows[0];
  const iNguoiGT = headers.indexOf('NguoiGioiThieu');
  const iMaGT    = headers.indexOf('MaGioiThieu');
  
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i][iNguoiGT]).trim();
    const code = String(rows[i][iMaGT]).trim();
    if (!name) continue;
    
    if (!map[code]) {
      map[code] = { name, code, count: 0 };
    }
    map[code].count++;
  }
  
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
}

// ══════════════════════════════════════
//          COURSES
// ══════════════════════════════════════

function getCourses() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.KHOA_HOC);
  if (!sh) return [];
  
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const entry = {};
    headers.forEach((h, idx) => {
      if (h) entry[h] = rows[i][idx];
    });
    if (entry.TrangThai === 'DangMo') {
      result.push(entry);
    }
  }
  
  return result;
}

// ══════════════════════════════════════
//          REGISTER (Admin use)
// ══════════════════════════════════════

function handleRegister(body) {
  const { hoTen, sdt, cccd, email, khoaHoc, refCode } = body;
  
  if (!hoTen || !sdt) {
    return { ok: false, error: 'Thiếu Họ tên hoặc SĐT.' };
  }
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  
  // Check trùng SĐT
  const iSDT = headers.indexOf('SDT');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iSDT]).trim().replace(/\s/g, '') === sdt.trim().replace(/\s/g, '')) {
      return { ok: false, error: 'Số điện thoại đã được đăng ký.' };
    }
  }
  
  // Sinh mã HV
  const maHV = 'ORI-' + String(rows.length).padStart(4, '0');
  
  // Sinh mã giới thiệu
  const maGioiThieu = 'REF-' + generateCode(5);
  
  // Tính giảm giá nếu có refCode
  let giaGoc = 0;
  let giamGia = 0;
  let hoaHong = 0;
  
  if (khoaHoc) {
    const shKH = ss.getSheetByName(SH.KHOA_HOC);
    const khRows = shKH.getDataRange().getValues();
    const khHeaders = khRows[0];
    const iMaKH = khHeaders.indexOf('MaKH');
    const iGia  = khHeaders.indexOf('GiaGoc');
    const iGiaKM = khHeaders.indexOf('GiaKM');
    
    for (let i = 1; i < khRows.length; i++) {
      if (String(khRows[i][iMaKH]).trim() === khoaHoc) {
        giaGoc = Number(khRows[i][iGiaKM] || khRows[i][iGia]) || 0;
        break;
      }
    }
  }
  
  if (refCode && giaGoc > 0) {
    giamGia = Math.round(giaGoc * 0.05);
    hoaHong = Math.round(giaGoc * 0.10);
  }
  
  // Thêm học viên mới
  const newRow = [];
  headers.forEach(h => {
    switch (h) {
      case 'MaHV':          newRow.push(maHV); break;
      case 'HoTen':         newRow.push(toTitle(hoTen)); break;
      case 'SDT':           newRow.push(sdt.trim()); break;
      case 'CCCD':          newRow.push(cccd || ''); break;
      case 'Email':         newRow.push(email || ''); break;
      case 'NgayVaoHoc':    newRow.push(new Date()); break;
      case 'KhoaHoc':       newRow.push(khoaHoc || ''); break;
      case 'MaGioiThieu':   newRow.push(maGioiThieu); break;
      case 'GioiThieuBoi':  newRow.push(refCode || ''); break;
      case 'TrangThai':     newRow.push('HocThu'); break;
      case 'NgayTao':       newRow.push(new Date()); break;
      default:              newRow.push('');
    }
  });
  sh.appendRow(newRow);
  
  // Ghi lịch sử giới thiệu
  if (refCode && giaGoc > 0) {
    const shGT = ss.getSheetByName(SH.GIOI_THIEU);
    if (shGT) {
      // Tìm tên người giới thiệu
      const iMaGT = headers.indexOf('MaGioiThieu');
      const iHoTen2 = headers.indexOf('HoTen');
      let nguoiGT = '';
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][iMaGT]).trim() === refCode) {
          nguoiGT = String(rows[i][iHoTen2]);
          break;
        }
      }
      
      shGT.appendRow([
        refCode,
        nguoiGT,
        toTitle(hoTen),
        maHV,
        new Date(),
        khoaHoc,
        giaGoc,
        giamGia,
        hoaHong,
        'ChuaThanhToan',
        ''
      ]);
    }
  }
  
  return {
    ok: true,
    data: {
      maHV,
      maGioiThieu,
      giamGia,
      message: giamGia > 0
        ? `Đăng ký thành công! Bạn được giảm ${formatMoney(giamGia)} nhờ mã giới thiệu.`
        : 'Đăng ký thành công!'
    }
  };
}

// ── Utilities ──
function generateCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function toTitle(str) {
  return str.trim().toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
}

function formatMoney(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

// ── SETUP: Tạo sheet mẫu ──
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Sheet HocVien
  let sh = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) {
    sh = ss.insertSheet(SH.HOC_VIEN);
    sh.appendRow(['MaHV','HoTen','SDT','CCCD','Email','NgayVaoHoc','KhoaHoc','MaGioiThieu','GioiThieuBoi','TrangThai','NgayTao']);
    // Dữ liệu mẫu
    sh.appendRow(['ORI-0001','Nguyễn Văn An','0901234567','012345678901','an.nguyen@gmail.com',new Date(2025,0,15),'TOEIC-450','REF-AN7X3','','ChinhThuc',new Date()]);
    sh.appendRow(['ORI-0002','Trần Thị Bình','0912345678','012345678902','binh.tran@gmail.com',new Date(2025,1,1),'TOEIC-650','REF-BH4K9','REF-AN7X3','HocThu',new Date()]);
    sh.appendRow(['ORI-0003','Lê Hoàng Cường','0923456789','012345678903','cuong.le@gmail.com',new Date(2025,2,10),'IELTS-5.5','REF-CG6M2','','ChinhThuc',new Date()]);
  }
  
  // Sheet LichSuHoc
  sh = ss.getSheetByName(SH.LICH_SU);
  if (!sh) {
    sh = ss.insertSheet(SH.LICH_SU);
    sh.appendRow(['MaHV','Ngay','KhoaHoc','BaiHoc','DiemDanh','GhiChu','Diem']);
    sh.appendRow(['ORI-0001',new Date(2025,0,16),'TOEIC-450','Listening Part 1','CoMat','Tốt',85]);
    sh.appendRow(['ORI-0001',new Date(2025,0,18),'TOEIC-450','Reading Part 5','CoMat','Cần cải thiện grammar',70]);
    sh.appendRow(['ORI-0001',new Date(2025,0,20),'TOEIC-450','Listening Part 2','CoMat','Xuất sắc',92]);
    sh.appendRow(['ORI-0002',new Date(2025,1,2),'TOEIC-650','Grammar Foundation','CoMat','Ổn',78]);
  }
  
  // Sheet GioiThieu
  sh = ss.getSheetByName(SH.GIOI_THIEU);
  if (!sh) {
    sh = ss.insertSheet(SH.GIOI_THIEU);
    sh.appendRow(['MaGioiThieu','NguoiGioiThieu','NguoiDuocGT','MaHV_DuocGT','NgayGioiThieu','KhoaHocDK','GiaGoc','GiamGia_5pct','HoaHong_10pct','TrangThaiHH','NgayThanhToan']);
    sh.appendRow(['REF-AN7X3','Nguyễn Văn An','Trần Thị Bình','ORI-0002',new Date(2025,1,1),'TOEIC-650',5500000,275000,550000,'ChuaThanhToan','']);
  }
  
  // Sheet KhoaHoc
  sh = ss.getSheetByName(SH.KHOA_HOC);
  if (!sh) {
    sh = ss.insertSheet(SH.KHOA_HOC);
    sh.appendRow(['MaKH','TenKhoaHoc','Nhom','MoTa','ThoiLuong','SoBuoi','GiaGoc','GiaKM','DoiTuong','UuDai','TrangThai','Icon']);
    
    // ── TOEIC ──
    sh.appendRow(['KH01','TOEIC Cơ Bản 12 Buổi','TOEIC','Nền tảng vững chắc','1 tháng','12 buổi/tháng',1600000,'','','Ưu đãi nhóm','DangMo','📘']);
    sh.appendRow(['KH02','TOEIC Nâng Cao 20 Buổi','TOEIC','Tăng khoảng 50 điểm','1 tháng','20 buổi/tháng',2500000,'','','Ưu đãi nhóm','DangMo','📗']);
    sh.appendRow(['KH03','TOEIC 600','TOEIC','Đạt 500-600 điểm','10-12 tháng','Không giới hạn',12000000,'','','Tặng lý viết & CV 1 lần','DangMo','📕']);
    sh.appendRow(['KH04','TOEIC 750','TOEIC','Đạt 610-750 điểm','Đến khi đạt','Không giới hạn',15000000,'','','Tặng lý viết & CV 1 lần','DangMo','🏆']);
    
    // ── GIAO TIẾP ──
    sh.appendRow(['KH05','Giao Tiếp Chuẩn Quốc Tế','Giao Tiếp','Phản xạ + trợ giảng nước ngoài','6 tháng (+2 bonus)','Không giới hạn',15000000,'','','Đối tác >10 HV mới 1DP miễn phí','DangMo','🌍']);
    
    // ── HÀNG KHÔNG ──
    sh.appendRow(['KH06','TA Chuyên Ngành Hàng Không','Hàng Không','Sách chuyên ngành, chuẩn training','2 tháng','Max 15 HV/lớp',10000000,'','','','DangMo','✈️']);
    
    // ── AI TOOLS ──
    sh.appendRow(['KH07','Kỹ Năng AI Trong Học Tập','AI Tools','7 AI tools chuyên dụng','1 tháng','10 buổi',3000000,'','','Tặng TK Gemini Pro + App ghi bài','DangMo','🤖']);
    
    // ── COMBO ──
    sh.appendRow(['KH08','Combo TOEIC 600 & Giao Tiếp','Combo','TOEIC 650-700+ & Giao tiếp','12 tháng','Không giới hạn',12000000,'','','Tiết kiệm 7 triệu + CV 1 lần','DangMo','🎁']);
    sh.appendRow(['KH09','Combo TOEIC 750 & Giao Tiếp','Combo','TOEIC 650-700+ & Giao tiếp','12 tháng','Không giới hạn',25000000,'','','Tiết kiệm 18tr + CV 3 lần','DangMo','💎']);
    
    // ── TRỌN ĐỜI ──
    sh.appendRow(['KH10','Lộ Trình NV Mặt Đất','Trọn Đời','TOEIC + GT + HK + AI + PV mặt đất','Đến khi có việc','Không giới hạn',35000000,'','','','DangMo','🛫']);
    sh.appendRow(['KH11','Lộ Trình Tiếp Viên HK','Trọn Đời','TOEIC + GT + HK + AI + PV tiếp viên','Đến khi có việc','Không giới hạn',45000000,'','','','DangMo','👩‍✈️']);
    
    // ── PV TIẾP VIÊN ──
    sh.appendRow(['PV01','PV Basic – Ready to Fly','PV Tiếp Viên','Coaching cấp tốc hãng nội địa','Theo lịch coaching','6 buổi 1-1',3000000,'','Cần bổ sung cho hồ sơ','Tặng 1 CV miễn phí','DangMo','🛩️']);
    sh.appendRow(['PV02','PV Silver – Confidence Booster','PV Tiếp Viên','Toàn diện phỏng vấn','Theo lịch coaching','12 buổi 1-1',5000000,'','Muốn thi 2-3 hãng nội địa','2 lần CV + Tặng GT Phỏng vấn','DangMo','🥈']);
    sh.appendRow(['PV03','PV Premium – Global Reach','PV Tiếp Viên','Chinh phục hàng quốc tế','Theo lịch coaching','16 buổi 1-1',8000000,'','Emirates, Qatar, EVA...','3 lần CV + 2 Tặng GT Phỏng vấn','DangMo','🥇']);
    
    // ── PV MẶT ĐẤT ──
    sh.appendRow(['PV04','PV Elite – The Career Partner','PV Mặt Đất','Đồng hành chỉnh luyện, cam kết sát thi','Theo lịch coaching','Không giới hạn',10000000,'','Muốn bám đậm, không giới hạn','3 lần CV + 2 Tặng GT','DangMo','⭐']);
    sh.appendRow(['PV05','Ground Basic – Ready for Counter','PV Mặt Đất','Coaching trọng tâm vị trí mặt đất','Theo lịch coaching','6 buổi 1-1',3000000,'','Check-in, Lounge, Gate, Ticketing','Tặng 1 lần CV miễn phí','DangMo','🎫']);
    sh.appendRow(['PV06','Ground Guarantee – Hired & Safe','PV Mặt Đất','Bảo hành đến khi đậu mặt đất','Đến khi đậu','Không giới hạn',10000000,'','SASCO, VIAGS, SAGS, hãng bay...','2 lần CV miễn phí','DangMo','🛡️']);
  }
  
  Logger.log('✅ Tất cả sheets đã được tạo thành công!');
}

// ╔══════════════════════════════════════════════════════════╗
// ║       ADMIN API — Gọi từ Dashboard Web                  ║
// ╚══════════════════════════════════════════════════════════╝

/**
 * Tạo tài khoản Admin — Chạy 1 lần duy nhất
 */
function createAdminAccount() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iHoTen = headers.indexOf('HoTen');
  
  // Check nếu Admin đã tồn tại
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iHoTen]).trim().toLowerCase() === 'admin') {
      Logger.log('⚠️ Tài khoản Admin đã tồn tại.');
      return;
    }
  }
  
  const maHV = 'ADMIN-001';
  const newRow = [];
  headers.forEach(h => {
    switch (h) {
      case 'MaHV':          newRow.push(maHV); break;
      case 'HoTen':         newRow.push('Admin'); break;
      case 'SDT':           newRow.push('010813'); break;
      case 'CCCD':          newRow.push(''); break;
      case 'Email':         newRow.push('admin@ori.academy'); break;
      case 'NgayVaoHoc':    newRow.push(new Date()); break;
      case 'KhoaHoc':       newRow.push('ALL'); break;
      case 'MaGioiThieu':   newRow.push('REF-ADMIN'); break;
      case 'GioiThieuBoi':  newRow.push(''); break;
      case 'TrangThai':     newRow.push('Admin'); break;
      case 'NgayTao':       newRow.push(new Date()); break;
      default:              newRow.push('');
    }
  });
  sh.appendRow(newRow);
  Logger.log('✅ Tài khoản Admin đã được tạo thành công!');
  Logger.log('   Đăng nhập: Họ tên = Admin | Mật khẩu = 010813');
}

/** Danh sách tất cả học viên */
function adminListStudents() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  
  const students = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][headers.indexOf('TrangThai')]).trim() === 'Admin') continue;
    const entry = {};
    headers.forEach((h, idx) => {
      if (h) {
        let val = rows[i][idx];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
        }
        entry[h] = val;
      }
    });
    students.push(entry);
  }
  return { ok: true, data: students };
}

/** Thêm nhật ký học tập qua API */
function adminAddHistoryAPI(body) {
  const { maHV, ngay, khoaHoc, baiHoc, diemDanh, ghiChu, diem } = body;
  if (!maHV || !baiHoc) {
    return { ok: false, error: 'Thiếu mã HV hoặc bài học.' };
  }
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.LICH_SU);
  if (!sh) return { ok: false, error: 'Sheet LichSuHoc không tồn tại.' };
  
  const date = ngay ? new Date(ngay) : new Date();
  sh.appendRow([maHV, date, khoaHoc || '', baiHoc, diemDanh || 'CoMat', ghiChu || '', Number(diem) || 0]);
  
  return { ok: true, message: 'Đã thêm nhật ký cho ' + maHV };
}

/** Cập nhật trạng thái hoa hồng */
function adminUpdateCommission(body) {
  const { rowIndex, status } = body;
  if (!rowIndex) return { ok: false, error: 'Thiếu vị trí dòng.' };
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.GIOI_THIEU);
  if (!sh) return { ok: false, error: 'Sheet GioiThieu không tồn tại.' };
  
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const iTrangThai = headers.indexOf('TrangThaiHH');
  const iNgayTT    = headers.indexOf('NgayThanhToan');
  
  const newStatus = status || 'DaThanhToan';
  sh.getRange(rowIndex + 1, iTrangThai + 1).setValue(newStatus);
  if (newStatus === 'DaThanhToan') {
    sh.getRange(rowIndex + 1, iNgayTT + 1).setValue(new Date());
  }
  
  return { ok: true, message: 'Đã cập nhật trạng thái hoa hồng.' };
}

// ╔══════════════════════════════════════════════════════════╗
// ║       ADMIN TOOLS — Chạy từ Apps Script Editor          ║
// ╚══════════════════════════════════════════════════════════╝

/**
 * 🆕 THÊM HỌC VIÊN MỚI
 * Cách dùng: Sửa thông tin bên dưới → Chọn hàm này → Bấm Run
 * Hệ thống sẽ tự động:
 *   - Sinh mã HV (ORI-0004, 0005...)
 *   - Sinh mã giới thiệu (REF-XXXXX)
 *   - Tính giảm giá 5% nếu có mã giới thiệu
 *   - Ghi hoa hồng 10% cho người giới thiệu
 */
function adminAddStudent() {
  // ═══ SỬA THÔNG TIN Ở ĐÂY ═══
  const hoTen      = 'Trần Ngọc Diễm';     // Họ và tên
  const sdt        = '0906303373';           // Số điện thoại
  const cccd       = '';                     // CCCD (tùy chọn)
  const email      = '';                     // Email (tùy chọn)
  const khoaHoc    = 'KH03';                // Mã khóa học (KH01, KH02,... PV01,...)
  const trangThai  = 'HocThu';              // HocThu hoặc ChinhThuc
  const refCode    = '';                     // Mã giới thiệu của người GT (VD: REF-AN7X3), để trống nếu không có
  // ═══════════════════════════════

  const result = handleRegister({ hoTen, sdt, cccd, email, khoaHoc, refCode });
  
  if (result.ok) {
    Logger.log('✅ ' + result.data.message);
    Logger.log('   Mã HV: ' + result.data.maHV);
    Logger.log('   Mã giới thiệu: ' + result.data.maGioiThieu);
    if (result.data.giamGia > 0) {
      Logger.log('   Giảm giá: ' + formatMoney(result.data.giamGia));
    }
  } else {
    Logger.log('❌ Lỗi: ' + result.error);
  }
}

/**
 * 📝 THÊM NHẬT KÝ HỌC TẬP
 * Cách dùng: Sửa thông tin bên dưới → Chọn hàm này → Bấm Run
 */
function adminAddHistory() {
  // ═══ SỬA THÔNG TIN Ở ĐÂY ═══
  const maHV     = 'ORI-0001';              // Mã học viên
  const ngay     = new Date();               // Ngày học (để new Date() = hôm nay)
  const khoaHoc  = 'TOEIC-450';             // Tên khóa học
  const baiHoc   = 'Listening Part 3';      // Tên bài học
  const diemDanh = 'CoMat';                 // CoMat / Vang / PhepVang
  const ghiChu   = 'Làm bài tốt';          // Ghi chú
  const diem     = 85;                       // Điểm (để 0 nếu không có)
  // ═══════════════════════════════

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.LICH_SU);
  
  if (!sh) {
    Logger.log('❌ Sheet LichSuHoc không tồn tại. Chạy setupSheets() trước.');
    return;
  }
  
  sh.appendRow([maHV, ngay, khoaHoc, baiHoc, diemDanh, ghiChu, diem]);
  Logger.log('✅ Đã thêm nhật ký học tập cho ' + maHV + ': ' + baiHoc);
}

/**
 * 📝 THÊM NHIỀU NHẬT KÝ CÙNG LÚC
 * Cách dùng: Sửa danh sách bên dưới → Chọn hàm này → Bấm Run
 */
function adminAddMultipleHistory() {
  // ═══ SỬA DANH SÁCH Ở ĐÂY ═══
  const entries = [
    // [MaHV, Ngày, Khóa học, Bài học, Điểm danh, Ghi chú, Điểm]
    ['ORI-0001', new Date(), 'TOEIC-450', 'Reading Part 6', 'CoMat', 'Tốt', 80],
    ['ORI-0001', new Date(), 'TOEIC-450', 'Listening Part 4', 'CoMat', 'Cần luyện thêm', 72],
  ];
  // ═══════════════════════════════

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.LICH_SU);
  
  entries.forEach(row => {
    sh.appendRow(row);
  });
  
  Logger.log('✅ Đã thêm ' + entries.length + ' nhật ký học tập.');
}

/**
 * 🔑 TỰ ĐỘNG SINH MÃ GIỚI THIỆU
 * Cho những học viên chưa có mã giới thiệu trong sheet HocVien
 */
function autoFillRefCodes() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaGT = headers.indexOf('MaGioiThieu');
  
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][iMaGT] || String(rows[i][iMaGT]).trim() === '') {
      const newCode = 'REF-' + generateCode(5);
      sh.getRange(i + 1, iMaGT + 1).setValue(newCode);
      count++;
      Logger.log('  → ' + rows[i][headers.indexOf('HoTen')] + ': ' + newCode);
    }
  }
  
  Logger.log('✅ Đã sinh mã giới thiệu cho ' + count + ' học viên.');
}

// ╔══════════════════════════════════════════════════════════╗
// ║       PUBLIC: Tra cứu mã giới thiệu                    ║
// ╚══════════════════════════════════════════════════════════╝

/**
 * Tra cứu mã giới thiệu → trả tên người giới thiệu
 * Dùng cho form đăng ký public
 */
function lookupRefCode(refCode) {
  if (!refCode) return { ok: false, error: 'Thiếu mã giới thiệu.' };
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaGT = headers.indexOf('MaGioiThieu');
  const iHoTen = headers.indexOf('HoTen');
  
  const code = String(refCode).trim().toUpperCase();
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iMaGT]).trim().toUpperCase() === code) {
      return { 
        ok: true, 
        data: { 
          nguoiGioiThieu: rows[i][iHoTen],
          refCode: rows[i][iMaGT],
          giamGia: '5%'
        }
      };
    }
  }
  
  return { ok: false, error: 'Mã giới thiệu không tồn tại.' };
}

// ╔══════════════════════════════════════════════════════════╗
// ║       BACKUP: Sao lưu tự động hàng tuần                ║
// ╚══════════════════════════════════════════════════════════╝

/**
 * Sao lưu tất cả sheet sang file backup
 * Cài đặt: Project Settings → Script Properties → BACKUP_ID = ID của Sheets backup
 * Trigger: Triggers → weeklyBackup → Week timer → Monday 7-8am
 */
function weeklyBackup() {
  const backupId = PropertiesService.getScriptProperties().getProperty('BACKUP_ID');
  if (!backupId) {
    Logger.log('⚠️ Chưa cài đặt BACKUP_ID trong Script Properties.');
    return;
  }
  
  const source = SpreadsheetApp.openById(SHEET_ID);
  const backup = SpreadsheetApp.openById(backupId);
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');
  
  // Xóa các sheet backup cũ (giữ sheet đầu tiên)
  const existingSheets = backup.getSheets();
  for (let i = existingSheets.length - 1; i > 0; i--) {
    backup.deleteSheet(existingSheets[i]);
  }
  
  // Copy từng sheet
  const sheetNames = Object.values(SH);
  sheetNames.forEach(name => {
    const sh = source.getSheetByName(name);
    if (sh) {
      const data = sh.getDataRange().getValues();
      let target = backup.getSheetByName(name);
      if (!target) {
        target = backup.insertSheet(name);
      }
      target.clear();
      if (data.length > 0) {
        target.getRange(1, 1, data.length, data[0].length).setValues(data);
      }
      Logger.log('  ✅ Backup: ' + name + ' (' + (data.length - 1) + ' rows)');
    }
  });
  
  // Đổi tên sheet đầu tiên thành timestamp
  const first = backup.getSheets()[0];
  if (first.getName() !== sheetNames[0]) {
    first.setName('_Backup_' + timestamp);
  }
  
  Logger.log('🗄️ Backup hoàn thành lúc ' + timestamp);
}

/** Test backup ngay lập tức */
function testBackupNow() {
  Logger.log('🔄 Bắt đầu backup test...');
  weeklyBackup();
}
