# Định dạng file bài học — `*.lesson.json` (schemaVersion 1)

Mỗi bài học là **một file JSON UTF-8**, tên kết thúc bằng `.lesson.json`
(ví dụ `lesson-05.lesson.json`). Admin vào **Quản trị → Import bài**, chọn file,
xem preview rồi bấm **Import bài**. Không cần sửa code.

- File mẫu: [`data/templates/lesson-template.lesson.json`](../data/templates/lesson-template.lesson.json)
  (cũng tải được bằng nút **Tải file mẫu** trong trang Import).
- 4 bài mặc định: [`data/default-lessons/`](../data/default-lessons/).
- Kiểu TypeScript: [`lib/lesson-schema.ts`](../lib/lesson-schema.ts); bộ kiểm tra: [`lib/lesson-validator.ts`](../lib/lesson-validator.ts).

> **Gợi ý khi nhờ AI tạo bài:** gửi kèm file này và nói
> “Hãy chuyển nội dung sau thành một file `.lesson.json` theo schemaVersion 1 trong LESSON_FORMAT.md”.

---

## 1. Cấu trúc tổng thể

```jsonc
{
  "schemaVersion": 1,          // bắt buộc, luôn là 1
  "id": "pronouns-01",         // bắt buộc, mã bài duy nhất
  "order": 1,                  // nên có, số nguyên ≥ 0 — thứ tự hiển thị
  "title": "Đại từ nhân xưng", // bắt buộc, 1–120 ký tự
  "description": "…",          // tuỳ chọn, ≤ 500 ký tự
  "level": "A1",               // bắt buộc: A1 | A2 | B1 | B2 | C1 | C2
  "published": true,           // bắt buộc: true = học viên thấy, false = ẩn
  "audio": { … },              // tuỳ chọn — phát âm
  "vocabulary": [ … ],         // tuỳ chọn — danh sách từ cho mục "Học từ"
  "questions": [ … ]           // bắt buộc, 1–200 câu
}
```

Không được thêm trường ngoài danh sách trên — file sẽ bị từ chối (để bắt lỗi gõ sai tên trường).

### `schemaVersion`
Luôn là số `1`. Khi định dạng thay đổi trong tương lai sẽ tăng lên 2.

### `id`
- Chỉ dùng **a-z, 0-9, `-`, `_`** (chữ thường, không dấu, không khoảng trắng), tối đa 64 ký tự.
- Không dùng `/ . # $ [ ]` (giới hạn của Firebase).
- Import một file có `id` trùng bài đã có → hệ thống hỏi **Ghi đè** và bắt xác nhận lần hai.

### `order`
Số nguyên ≥ 0, bài nhỏ hơn hiện trước. Có thể đổi lại bằng nút ↑ ↓ trong Admin.

### `level`
Một trong `A1, A2, B1, B2, C1, C2`.

### `published`
`true` → xuất hiện ngay ở trang học viên. `false` → chỉ admin thấy (dùng **Xem thử** để kiểm tra trước).

---

## 2. `audio` — phát âm tự động

Website dùng giọng đọc của trình duyệt (Web Speech API). **Không cần file MP3.**

```json
"audio": { "enabled": true, "mode": "tts", "language": "en-US", "rate": 0.85 }
```

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `enabled` | có | `false` để ẩn mọi nút 🔊 của bài |
| `mode` | có | `"tts"` (giọng đọc tự động). `"file"` dành cho tương lai, hiện vẫn đọc bằng tts |
| `language` | không | `"en-US"` hoặc `"en-GB"`. **Bỏ trống để theo lựa chọn US/UK của học viên** (khuyên dùng) |
| `rate` | không | Tốc độ 0.5–1.5, mặc định 0.85 |

---

## 3. `vocabulary` — mục "Học từ"

```json
"vocabulary": [
  { "word": "they", "ipa": "/ðeɪ/", "meaning": "họ", "speak": "they" },
  { "word": "thank you", "meaning": "cảm ơn", "example": "Thank you very much!" }
]
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `word` | có | ≤ 100 ký tự |
| `meaning` | có | nghĩa tiếng Việt, ≤ 200 |
| `ipa` | không | phiên âm, chỉ để hiển thị (**không bao giờ được đọc lên**) |
| `speak` | không | chữ được đọc khi bấm 🔊; mặc định = `word` |
| `example` | không | câu ví dụ |

Bài không có `vocabulary` vẫn hợp lệ — nút "Học từ" sẽ không hiện.

---

## 4. `questions` — câu hỏi

Mọi câu hỏi có các trường chung:

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `id` | có | duy nhất trong bài, ví dụ `"q1"`; chỉ chữ, số, `-`, `_` |
| `type` | có | xem bảng loại câu bên dưới |
| `prompt` | có | câu hỏi/hướng dẫn, ≤ 500 ký tự |
| `display` | không | chữ to hiển thị phía trên (từ, IPA, câu có `___`) |
| `speak` | không* | từ được đọc khi bấm **🔊 Nghe** (≤ 200 ký tự, không ghi IPA). *Bắt buộc với `listen_choose` |
| `speakSentence` | không | cả câu được đọc khi bấm **🔊 Nghe câu** (≤ 500) |
| `explanation` | không | giải thích hiện sau khi trả lời |
| `options` | tuỳ loại | danh sách lựa chọn `{ "id": "A", "text": "…" }`, 2–8 lựa chọn, `id` không trùng |
| `correctAnswer` | có | **id của lựa chọn đúng** (vd `"B"`), hoặc **chữ đúng** với câu gõ chữ |
| `acceptedAnswers` | không | chỉ cho `fill_blank` gõ chữ: các cách viết khác vẫn tính đúng |

### Các loại câu (`type`)

| type | Học viên làm gì | Cần `options` | Nút 🔊 hiện khi nào |
|---|---|---|---|
| `multiple_choice` | Trắc nghiệm chung | có | ngay từ đầu |
| `word_to_meaning` | Thấy từ tiếng Anh → chọn nghĩa | có | ngay từ đầu |
| `meaning_to_word` | Thấy nghĩa → chọn từ tiếng Anh | có | sau khi trả lời (để không lộ đáp án) |
| `ipa_to_word` | Thấy IPA → chọn từ | có | sau khi trả lời |
| `listen_choose` | Nghe → chọn từ (chữ `display` bị ẩn) | có | luôn — nút lớn "Nghe lại" |
| `fill_blank` | Điền vào `___` — chọn **hoặc** gõ | không bắt buộc | sau khi trả lời |

**`fill_blank`:**
- Có `options` → học viên chọn; `correctAnswer` là **id** lựa chọn.
- Không có `options` → học viên gõ chữ; `correctAnswer` là **từ đúng**. So sánh không phân biệt hoa/thường,
  bỏ khoảng trắng thừa và dấu `.` `!` `?` ở cuối. Thêm `acceptedAnswers` nếu có nhiều cách đúng.

### Lỗi thường gặp (website sẽ báo đúng câu và cách sửa)

| Lỗi | Cách sửa |
|---|---|
| `correctAnswer "E" không tồn tại trong options` | Đặt `correctAnswer` là một id có trong `options` |
| `id câu hỏi "q3" bị trùng` | Đổi id cho khác nhau |
| `Thiếu "title"` | Thêm `"title": "…"` |
| `id "Bai 1" không hợp lệ` | Dùng chữ thường, số, `-`, `_`: `"bai-1"` |
| `JSON không hợp lệ` ở dòng N | Kiểm tra dấu phẩy/ngoặc kép/ngoặc `{ } [ ]` quanh dòng đó |

---

## 5. Ví dụ hoàn chỉnh

### Ví dụ 1 — Bài từ vựng nhỏ (nghĩa, nghe, IPA)

```json
{
  "schemaVersion": 1,
  "id": "family-01",
  "order": 5,
  "title": "Gia đình",
  "description": "Các thành viên trong gia đình.",
  "level": "A1",
  "published": true,
  "audio": { "enabled": true, "mode": "tts", "rate": 0.85 },
  "vocabulary": [
    { "word": "mother", "ipa": "/ˈmʌðə(r)/", "meaning": "mẹ" },
    { "word": "father", "ipa": "/ˈfɑːðə(r)/", "meaning": "bố" },
    { "word": "sister", "ipa": "/ˈsɪstə(r)/", "meaning": "chị/em gái" },
    { "word": "brother", "ipa": "/ˈbrʌðə(r)/", "meaning": "anh/em trai" }
  ],
  "questions": [
    {
      "id": "q1",
      "type": "word_to_meaning",
      "prompt": "\"mother\" nghĩa là gì?",
      "display": "mother",
      "speak": "mother",
      "options": [
        { "id": "A", "text": "bố" },
        { "id": "B", "text": "mẹ" },
        { "id": "C", "text": "chị gái" }
      ],
      "correctAnswer": "B",
      "explanation": "mother = mẹ"
    },
    {
      "id": "q2",
      "type": "listen_choose",
      "prompt": "Nghe và chọn từ đúng",
      "speak": "brother",
      "options": [
        { "id": "A", "text": "mother" },
        { "id": "B", "text": "sister" },
        { "id": "C", "text": "brother" },
        { "id": "D", "text": "father" }
      ],
      "correctAnswer": "C"
    },
    {
      "id": "q3",
      "type": "ipa_to_word",
      "prompt": "Từ nào có phiên âm /ˈfɑːðə(r)/?",
      "display": "/ˈfɑːðə(r)/",
      "speak": "father",
      "options": [
        { "id": "A", "text": "father" },
        { "id": "B", "text": "mother" }
      ],
      "correctAnswer": "A"
    }
  ]
}
```

### Ví dụ 2 — Điền từ (vừa chọn vừa gõ)

```json
{
  "schemaVersion": 1,
  "id": "to-be-01",
  "order": 6,
  "title": "Động từ to be",
  "level": "A1",
  "published": false,
  "audio": { "enabled": true, "mode": "tts", "language": "en-GB" },
  "questions": [
    {
      "id": "q1",
      "type": "fill_blank",
      "prompt": "Chọn từ đúng để điền vào chỗ trống.",
      "display": "I ___ a student.",
      "speakSentence": "I am a student.",
      "options": [
        { "id": "A", "text": "am" },
        { "id": "B", "text": "is" },
        { "id": "C", "text": "are" }
      ],
      "correctAnswer": "A",
      "explanation": "Đi với I dùng am."
    },
    {
      "id": "q2",
      "type": "fill_blank",
      "prompt": "Gõ từ còn thiếu.",
      "display": "They ___ my friends.",
      "speakSentence": "They are my friends.",
      "correctAnswer": "are",
      "acceptedAnswers": ["'re"],
      "explanation": "They + are."
    }
  ]
}
```

### Ví dụ 3 — Trắc nghiệm tổng hợp + nghĩa → từ

```json
{
  "schemaVersion": 1,
  "id": "greetings-01",
  "order": 7,
  "title": "Chào hỏi",
  "description": "Câu chào hỏi thông dụng.",
  "level": "A1",
  "published": true,
  "audio": { "enabled": true, "mode": "tts" },
  "vocabulary": [
    { "word": "hello", "ipa": "/həˈləʊ/", "meaning": "xin chào" },
    { "word": "goodbye", "ipa": "/ˌɡʊdˈbaɪ/", "meaning": "tạm biệt" },
    { "word": "good morning", "meaning": "chào buổi sáng", "example": "Good morning, teacher!" }
  ],
  "questions": [
    {
      "id": "q1",
      "type": "meaning_to_word",
      "prompt": "Từ tiếng Anh nào có nghĩa là \"tạm biệt\"?",
      "display": "tạm biệt",
      "speak": "goodbye",
      "options": [
        { "id": "A", "text": "hello" },
        { "id": "B", "text": "goodbye" },
        { "id": "C", "text": "good morning" },
        { "id": "D", "text": "thanks" }
      ],
      "correctAnswer": "B"
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "prompt": "Buổi sáng gặp cô giáo, em nói gì?",
      "speakSentence": "Good morning, teacher!",
      "options": [
        { "id": "A", "text": "Good night" },
        { "id": "B", "text": "Goodbye" },
        { "id": "C", "text": "Good morning" }
      ],
      "correctAnswer": "C",
      "explanation": "Good morning dùng vào buổi sáng."
    }
  ]
}
```

---

## 6. Quy trình thêm bài mới

1. Soạn nội dung (hoặc nhờ AI) → lưu thành `ten-bai.lesson.json`.
2. Admin → **Import bài** → kéo thả file.
3. Nếu có ❌ lỗi: sửa đúng dòng/câu được báo rồi chọn lại file.
4. ✅ File hợp lệ → xem preview → **Import bài**.
5. Nếu `published: true` bài xuất hiện ngay ở trang học viên (không cần tải lại trang).
