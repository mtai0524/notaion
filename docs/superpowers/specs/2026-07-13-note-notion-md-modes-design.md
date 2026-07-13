# Design — Tách 2 format Note: Notion (mặc định) + Markdown (opt-in)

**Ngày:** 2026-07-13
**Phạm vi:** Daily Note TUI editor (`src/components/pages/Note/`)

## Vấn đề

Editor body của Daily Note hiện tại là một textarea markdown thô kèm toolbar chèn
cú pháp markdown và preview render — tức "nửa Notion nửa markdown". Người dùng chủ
yếu dùng kiểu Notion (trực quan) nên trải nghiệm bị lẫn lộn: vừa thấy block đã
render, vừa phải gõ `**`, `> [!note]`, `> [>]`.

Yêu cầu: tách rõ **2 format riêng biệt**.

- **Notion mode (mặc định):** WYSIWYG block-based, trực quan. KHÔNG hiện cú pháp
  markdown thô. Slash `/` ra menu block, kéo-thả sắp xếp block, edit inline.
- **Markdown mode (opt-in):** editor markdown thô hiện tại, giữ nguyên. Bật khi
  người dùng chọn trong Options.

Hai mode thao tác trên **cùng một nội dung** và chuyển qua lại không mất dữ liệu.

## Nguyên tắc cốt lõi

**Nguồn sự thật duy nhất: `content` = một chuỗi markdown.**

- Không đổi backend, không migrate DB, tương thích 100% note cũ.
- Cả 2 mode đọc/ghi cùng `content`.
- Nhập ở Notion → chuyển sang md thấy đúng markdown của nội dung đó, sửa tiếp →
  về Notion thấy kết quả render. Cùng 1 nội dung, 2 cách thao tác.

```
content (markdown string)  ←── nguồn sự thật duy nhất
    │
    ├── NOTION mode (mặc định)
    │      parse content → blocks[]  → render WYSIWYG trực quan
    │      edit inline / slash / drag-drop  → serialize blocks[] → content
    │
    └── MARKDOWN mode (opt-in qua Options)
           textarea markdown thô (editor hiện tại) — thao tác trực tiếp trên content
```

## Kiến trúc & module (cô lập, test được)

| Module | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `noteFormat.js` | parse markdown → `blocks[]` và serialize `blocks[]` → markdown. Thuần logic, test round-trip độc lập. | không |
| `NotionBlock.jsx` | render + edit inline **một** block. Nhận block, phát sự kiện đổi nội dung/loại. | `noteFormat`, `renderInline` |
| `NotionEditor.jsx` | danh sách block + slash menu + drag-drop. Ghép các `NotionBlock`. | `NotionBlock`, `noteFormat` |
| `TuiView.jsx` | chọn render `NotionEditor` (notion) hay textarea md (markdown) tùy mode. | cả hai |

**Ranh giới rõ:** `noteFormat` không biết React; `NotionBlock` không biết danh
sách; `NotionEditor` không biết TuiView. Đổi nội bộ 1 module không phá module khác.

## Notion mode — mô hình block

Parse `content` → `blocks[]`. Mỗi block là một đơn vị hiển thị:

| Block | Markdown nguồn | Hiển thị Notion |
|---|---|---|
| paragraph | `text thường` | dòng text, inline **đậm**/*nghiêng*/`code`/~~gạch~~ render sẵn |
| heading 1/2/3 | `#` / `##` / `###` | chữ to theo cấp |
| todo | `- [ ]` / `- [x]` | checkbox bấm được |
| bullet | `- ` | gạch đầu dòng |
| quote | `> ` | trích dẫn |
| callout | `> [!kind] …` (+ dòng `> ` tiếp theo) | box màu + icon; kind ∈ note/info/warning/success/danger |
| toggle | `> [>] title` + dòng con thụt ≥2 space | caret ▸ gập/mở, body là các dòng con |
| code | ```` ``` ```` … ```` ``` ```` | khối code |
| divider | `---` | đường kẻ ngang |
| image | `![alt](url)` | ảnh |
| file | `[📎 name](url)` / `[text](url)` | link |

**Cấu trúc mỗi block khi hiển thị:**

```
[⠿]  [ block đã render — bấm để sửa inline ]
 ↑ tay cầm kéo-thả (chỉ hiện khi hover)
```

### Edit inline (không lộ cú pháp)

- Bấm vào block → con trỏ nhấp nháy **ngay trong block đã render**, gõ như văn bản
  thường. Định dạng đậm/nghiêng hiển thị trực tiếp; **không bao giờ thấy `**` hay
  `> [!note]`**. Icon callout / caret toggle giữ nguyên khi đang sửa.
- Kỹ thuật: `contentEditable` per-block. Render node đã format; bắt input →
  serialize node về markdown → ghi `content`.
- Rời block (blur / Enter tạo block mới) → commit block đó.
- Block giao diện giữ nguyên khi active (không biến thành ô input thô).

### Slash menu `/`

- Gõ `/` ở đầu một block trống → menu chọn loại block (heading 1/2/3, todo,
  bullet, quote, callout + 4 loại, toggle, code, divider…). Có icon, trực quan —
  không phải "chèn cú pháp md".

### Drag & drop

- Mỗi block có tay cầm `⠿` (hover hiện). Kéo để đổi thứ tự block **trong 1 note**.
- Thả → serialize lại `content` theo thứ tự mới.

## Markdown mode

- Giữ **nguyên** editor hiện tại: textarea markdown thô + toolbar chèn cú pháp +
  `👁 Preview` + `? Markdown` cheatsheet. Không thay đổi gì.
- Giờ là 1 trong 2 mode; bật khi người dùng chọn `format: md`.

## Chuyển đổi mode

- Thêm mục `note format: ● notion / md` trong popup Options (phím `T`).
- Mặc định `notion`. Lưu `localStorage`, áp dụng **toàn cục** cho mọi note.
- Chuyển tức thì, không convert (cùng đọc/ghi `content` markdown).
- Đang sửa dở một block Notion mà chuyển sang md → **commit block hiện tại trước**
  rồi mới đổi mode.

## Xử lý biên

- **Markdown lạ / chưa hỗ trợ** (bảng, cú pháp ngoài danh sách): Notion mode render
  thành **paragraph thô an toàn** — hiển thị nguyên văn, không vỡ, không nuốt dữ
  liệu. Muốn sửa loại đó thì sang md mode.
- **Round-trip an toàn:** `parse → serialize` phải trả lại markdown tương đương.
  Test: nhập Notion → xem md → về Notion, nội dung không đổi.
- **Note rỗng:** Notion mode hiện 1 paragraph trống + placeholder "gõ / để chèn
  block".

## Ngoài phạm vi (YAGNI — làm sau)

- Nested block sâu nhiều tầng.
- Bảng WYSIWYG.
- Kéo-thả block **giữa các note** khác nhau.

## Tiêu chí hoàn thành

- Mặc định mở Daily Note ở Notion mode; không thấy cú pháp markdown thô.
- Slash `/`, edit inline, kéo-thả block hoạt động trong Notion mode.
- Options có toggle `notion / md`, mặc định notion, lưu localStorage, toàn cục.
- Bật md mode → editor markdown thô hiện tại, thao tác trên cùng nội dung.
- Chuyển Notion ↔ md không mất dữ liệu; round-trip test pass.
- Note cũ (markdown string) mở được ở cả 2 mode, không vỡ.
