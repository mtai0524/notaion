import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_SIZES, MIN, clampSizes, applyDelta, sizesFromDrag, SIZES_KEY, loadSizes, saveSizes } from './tuiResize';

const sum = (a) => a.reduce((x, y) => x + y, 0);

describe('clampSizes', () => {
  it('giữ nguyên mảng hợp lệ', () => {
    expect(clampSizes([16, 35, 49])).toEqual([16, 35, 49]);
  });
  it('tổng luôn về 100', () => {
    expect(sum(clampSizes([10, 10, 10]))).toBeCloseTo(100);
    expect(sum(clampSizes([50, 50, 50]))).toBeCloseTo(100);
  });
  it('ép sàn MIN', () => {
    const r = clampSizes([2, 49, 49]);
    expect(r[0]).toBeGreaterThanOrEqual(MIN);
    expect(sum(r)).toBeCloseTo(100);
  });
  it('đầu vào hỏng → mặc định', () => {
    expect(clampSizes(null)).toEqual(DEFAULT_SIZES);
    expect(clampSizes([1, 2])).toEqual(DEFAULT_SIZES);
    expect(clampSizes([NaN, 35, 49])).toEqual(DEFAULT_SIZES);
    expect(clampSizes([Infinity, 35, 49])).toEqual(DEFAULT_SIZES);
  });
});

describe('applyDelta', () => {
  it('FOLDERS mượn của NOTES, PREVIEW không đổi', () => {
    const r = applyDelta([16, 35, 49], 'folders', 2);
    expect(r[0]).toBeCloseTo(18);
    expect(r[1]).toBeCloseTo(33);
    expect(r[2]).toBeCloseTo(49);
  });
  it('NOTES thương lượng với PREVIEW', () => {
    const r = applyDelta([16, 35, 49], 'notes', 2);
    expect(r[0]).toBeCloseTo(16);
    expect(r[1]).toBeCloseTo(37);
    expect(r[2]).toBeCloseTo(47);
  });
  it('PREVIEW mượn của NOTES', () => {
    const r = applyDelta([16, 35, 49], 'preview', 2);
    expect(r[1]).toBeCloseTo(33);
    expect(r[2]).toBeCloseTo(51);
  });
  it('delta âm = thu lại', () => {
    const r = applyDelta([16, 35, 49], 'folders', -2);
    expect(r[0]).toBeCloseTo(14);
    expect(r[1]).toBeCloseTo(37);
  });
  it('dừng khi hàng xóm chạm sàn, không tràn sang panel thứ ba', () => {
    const r = applyDelta([16, 9, 75], 'folders', 10);
    expect(r[1]).toBeCloseTo(MIN);
    expect(r[0]).toBeCloseTo(17);
    expect(r[2]).toBeCloseTo(75);
    expect(sum(r)).toBeCloseTo(100);
  });
  it('không tự co dưới sàn', () => {
    const r = applyDelta([9, 42, 49], 'folders', -10);
    expect(r[0]).toBeCloseTo(MIN);
    expect(sum(r)).toBeCloseTo(100);
  });
  it('focus lạ → giữ nguyên', () => {
    expect(applyDelta([16, 35, 49], 'zzz', 2)).toEqual([16, 35, 49]);
  });
  it('tổng luôn bảo toàn', () => {
    let s = [16, 35, 49];
    for (const f of ['folders', 'notes', 'preview', 'folders']) s = applyDelta(s, f, 5);
    expect(sum(s)).toBeCloseTo(100);
  });
});

describe('sizesFromDrag', () => {
  it('biên 0: đặt mép phải của FOLDERS tại con trỏ, PREVIEW không đổi', () => {
    const r = sizesFromDrag([16, 35, 49], 0, 0.25);
    expect(r[0]).toBeCloseTo(25);
    expect(r[1]).toBeCloseTo(26);
    expect(r[2]).toBeCloseTo(49);
  });
  it('biên 1: đặt mép phải của NOTES tại con trỏ, FOLDERS không đổi', () => {
    const r = sizesFromDrag([16, 35, 49], 1, 0.7);
    expect(r[0]).toBeCloseTo(16);
    expect(r[1]).toBeCloseTo(54);
    expect(r[2]).toBeCloseTo(30);
  });
  it('kéo quá xa vẫn tôn trọng sàn MIN', () => {
    const a = sizesFromDrag([16, 35, 49], 0, 0.98);
    expect(a[1]).toBeGreaterThanOrEqual(MIN - 1e-6);
    expect(sum(a)).toBeCloseTo(100);
    const b = sizesFromDrag([16, 35, 49], 0, 0.0);
    expect(b[0]).toBeGreaterThanOrEqual(MIN - 1e-6);
    expect(sum(b)).toBeCloseTo(100);
  });
  it('biên lạ hoặc ratio hỏng → giữ nguyên', () => {
    expect(sizesFromDrag([16, 35, 49], 9, 0.5)).toEqual([16, 35, 49]);
    expect(sizesFromDrag([16, 35, 49], 0, NaN)).toEqual([16, 35, 49]);
  });
});

describe('loadSizes / saveSizes', () => {
  beforeEach(() => { localStorage.clear(); });

  it('chưa có gì → mặc định', () => {
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('lưu rồi đọc lại đúng', () => {
    saveSizes([20, 30, 50]);
    expect(loadSizes()).toEqual([20, 30, 50]);
  });
  it('JSON hỏng → mặc định', () => {
    localStorage.setItem(SIZES_KEY, '{nope');
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('sai độ dài → mặc định', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([50, 50]));
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('có NaN / không phải số → mặc định', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([null, 35, 49]));
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('tổng lệch quá → mặc định', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([10, 10, 10]));
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('dưới sàn → mặc định', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([2, 49, 49]));
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('lệch trong sai số ±0.5 vẫn nhận (và được chuẩn hoá)', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([16.2, 35, 49]));
    expect(sum(loadSizes())).toBeCloseTo(100);
  });
});
