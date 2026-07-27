import { describe, it, expect } from 'vitest';
import { describeUploadError, formatBytes, MB,
         cloudinaryKind, exceedsCloudinary, splitByDestination,
         isLocalStored, localStorageWarning } from './uploadError';

const mk = (size, type) => ({ size, type, name: `f-${size}` });

describe('cloudinaryKind', () => {
  it('phân loại theo mime type', () => {
    expect(cloudinaryKind(mk(1, 'image/png'))).toBe('image');
    expect(cloudinaryKind(mk(1, 'video/mp4'))).toBe('video');
    expect(cloudinaryKind(mk(1, 'application/pdf'))).toBe('raw');
  });
  it('excel là raw (trần 10MB)', () => {
    const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    expect(cloudinaryKind(mk(1, xlsx))).toBe('raw');
  });
  it('không có type → raw (đoán an toàn nhất)', () => {
    expect(cloudinaryKind(mk(1, ''))).toBe('raw');
    expect(cloudinaryKind({})).toBe('raw');
  });
});

describe('exceedsCloudinary', () => {
  const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  it('excel 18-20MB vượt trần raw 10MB — đúng ca của người dùng', () => {
    expect(exceedsCloudinary(mk(18 * MB, xlsx))).toBe(true);
    expect(exceedsCloudinary(mk(20 * MB, xlsx))).toBe(true);
  });
  it('file nhỏ thì không', () => {
    expect(exceedsCloudinary(mk(9 * MB, xlsx))).toBe(false);
    expect(exceedsCloudinary(mk(5 * MB, 'image/png'))).toBe(false);
  });
  it('đúng 10MB không tính là vượt (chỉ hơn mới vượt)', () => {
    expect(exceedsCloudinary(mk(10 * MB, xlsx))).toBe(false);
    expect(exceedsCloudinary(mk(10 * MB + 1, xlsx))).toBe(true);
  });
  it('video có trần riêng 100MB', () => {
    expect(exceedsCloudinary(mk(50 * MB, 'video/mp4'))).toBe(false);
    expect(exceedsCloudinary(mk(120 * MB, 'video/mp4'))).toBe(true);
  });
  it('size hỏng → không chặn (để server quyết)', () => {
    expect(exceedsCloudinary({ type: 'image/png' })).toBe(false);
    expect(exceedsCloudinary(mk(NaN, 'image/png'))).toBe(false);
  });
});

describe('splitByDestination', () => {
  const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  it('tách lô hỗn hợp đúng đích', () => {
    const small = mk(2 * MB, 'image/png');
    const big = mk(19 * MB, xlsx);
    const r = splitByDestination([small, big]);
    expect(r.cloud).toEqual([small]);
    expect(r.local).toEqual([big]);
  });
  it('giữ nguyên thứ tự trong từng nhóm', () => {
    const a = mk(1 * MB, 'image/png'), b = mk(2 * MB, 'image/png');
    expect(splitByDestination([a, b]).cloud).toEqual([a, b]);
  });
  it('lô rỗng không vỡ', () => {
    expect(splitByDestination([])).toEqual({ cloud: [], local: [] });
    expect(splitByDestination()).toEqual({ cloud: [], local: [] });
  });
});

const axiosErr = (status, data) => ({ response: { status, data } });

describe('formatBytes', () => {
  it('đổi đơn vị theo độ lớn', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(20 * 1024)).toBe('20 KB');
    expect(formatBytes(18.5 * MB)).toBe('18.5 MB');
  });
  it('đầu vào hỏng → dấu hỏi', () => {
    expect(formatBytes(undefined)).toBe('?');
    expect(formatBytes(NaN)).toBe('?');
    expect(formatBytes(-1)).toBe('?');
  });
});

describe('isLocalStored', () => {
  it('có cloudUrl → Cloudinary, không có → lưu nội bộ', () => {
    expect(isLocalStored({ cloudUrl: 'https://res.cloudinary.com/x.png' })).toBe(false);
    expect(isLocalStored({ savedName: 'abc.xlsx' })).toBe(true);
  });
  it('đầu vào rỗng không vỡ', () => {
    expect(isLocalStored(null)).toBe(false);
    expect(isLocalStored(undefined)).toBe(false);
  });
});

describe('localStorageWarning', () => {
  const cloud = { cloudUrl: 'https://res.cloudinary.com/a.png', originalName: 'a.png' };
  const local = { savedName: 'x1', originalName: 'baocao.xlsx' };

  it('toàn file Cloudinary → không cảnh báo', () => {
    expect(localStorageWarning([cloud, cloud])).toBeNull();
    expect(localStorageWarning([])).toBeNull();
    expect(localStorageWarning()).toBeNull();
  });
  it('một file nội bộ → nêu đúng tên và rủi ro mất file', () => {
    const msg = localStorageWarning([local]);
    expect(msg).toContain('baocao.xlsx');
    expect(msg).toContain('10MB');
    expect(msg).toMatch(/có thể mất/);
  });
  it('lô hỗn hợp chỉ đếm phần lưu nội bộ', () => {
    const msg = localStorageWarning([cloud, local, { savedName: 'x2', originalName: 'b.zip' }]);
    expect(msg).toContain('2 file');
    expect(msg).not.toContain('a.png');
  });
  it('thiếu originalName vẫn ra câu dùng được', () => {
    const msg = localStorageWarning([{ savedName: 'x' }]);
    expect(typeof msg).toBe('string');
    expect(msg).toMatch(/có thể mất/);
  });
});

describe('describeUploadError', () => {
  it('413 chỉ đúng thủ phạm là backend, không phải Cloudinary', () => {
    const msg = describeUploadError(axiosErr(413, ''), [{ size: 19 * MB }]);
    expect(msg).toContain('413');
    expect(msg).toContain('19.0 MB');
    expect(msg).toContain('KHÔNG phải Cloudinary');
  });

  it('bóc được thông báo lồng trong error.message (dạng Cloudinary)', () => {
    const msg = describeUploadError(
      axiosErr(400, { error: { message: 'File size too large. Got 19mb' } }));
    expect(msg).toContain('File size too large. Got 19mb');
  });

  it('bóc được message phẳng và ModelState của ASP.NET', () => {
    expect(describeUploadError(axiosErr(400, { message: 'bad file' })))
      .toContain('bad file');
    expect(describeUploadError(axiosErr(400, { errors: { files: ['too big'] } })))
      .toContain('too big');
  });

  it('body dạng chuỗi thuần vẫn dùng được', () => {
    expect(describeUploadError(axiosErr(500, 'Request body too large')))
      .toContain('Request body too large');
  });

  it('401/403 → gợi ý đăng nhập lại', () => {
    expect(describeUploadError(axiosErr(401, {}))).toMatch(/đăng nhập lại/);
    expect(describeUploadError(axiosErr(403, {}))).toMatch(/đăng nhập lại/);
  });

  it('5xx nhắc khả năng giới hạn dung lượng', () => {
    expect(describeUploadError(axiosErr(500, {}), [{ size: 20 * MB }]))
      .toContain('giới hạn dung lượng');
  });

  it('timeout và mất mạng phân biệt được', () => {
    expect(describeUploadError({ code: 'ECONNABORTED', message: 'timeout of 0ms' }))
      .toMatch(/quá thời gian chờ/);
    expect(describeUploadError({ message: 'Network Error' }))
      .toContain('Network Error');
  });

  it('lấy file LỚN NHẤT trong lô, không phải file đầu', () => {
    const msg = describeUploadError(axiosErr(413, ''),
      [{ size: 1 * MB }, { size: 20 * MB }, { size: 3 * MB }]);
    expect(msg).toContain('20.0 MB');
  });

  it('không có file vẫn không vỡ', () => {
    expect(() => describeUploadError(axiosErr(413, ''))).not.toThrow();
    expect(describeUploadError(axiosErr(413, ''))).toContain('413');
  });

  it('lỗi rỗng hoàn toàn vẫn trả câu dùng được', () => {
    const msg = describeUploadError(undefined);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
