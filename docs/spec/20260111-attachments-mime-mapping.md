# Lim Code：上传 Markdown 附件被当作图片发送导致 OpenAI 400 的定位

## 现象（用户反馈）
- 用户在 Lim Code 中上传附件：一个 Markdown 文档（`.md`）。
- 使用 **OpenAI Responses API** 渠道发送消息时，返回 400：

```json
{
  "error": {
    "message": "Invalid 'input[0].content[0].image_url'. Expected a base64-encoded data URL with an image MIME type ... but got unsupported MIME type 'text/markdown'.",
    "type": "invalid_request_error",
    "param": "input[0].content[0].image_url",
    "code": "invalid_value"
  }
}
```

## 快速结论
- 这不是上游（OpenAI Responses）“误判”的问题。
- **Lim Code 当前的请求构造逻辑会把任何 `inlineData` 类型的附件都映射为“图片字段”（`input_image` / `image_url` / Anthropic `image`）**。
- 当附件 MIME 类型为 `text/markdown`（Markdown 文件），被拼进图片字段后，上游按“图片 data URL”校验就会 400。

---

## 端到端数据链路（从 `.md` 到 OpenAI 400）

### 1) 前端：推断 `.md` 为 `text/markdown`
- `frontend/src/utils/file.ts:32`：
  - `.md` / `.markdown` -> `text/markdown`

### 2) 前端：附件序列化并发送到扩展端
- `frontend/src/composables/useAttachments.ts:63`：
  - 读取文件 -> `mimeType = inferMimeType(file.name, file.type)`
- `frontend/src/stores/chat/messageActions.ts:52`：
  - `attachments` 被序列化为 `{ id, name, type, size, mimeType, data, thumbnail }`
  - 通过 `sendToExtension('chatStream', { ..., attachments })` 发给扩展端

### 3) 后端：把“任何附件”都写成 `inlineData`
- `backend/modules/api/chat/services/MessageBuilderService.ts:39`：
  - `buildUserMessageParts()` 对每个附件都 `parts.push({ inlineData: { mimeType, data, id, name } })`
  - **这里没有区分图片/文档/代码**，全部走 `inlineData`

### 4) OpenAI Responses：把“任何 inlineData”都当 `input_image`
- `backend/modules/channel/formatters/openai-responses.ts:228` 之后：
  - 普通消息内容：
    - `part.inlineData` -> `{ type: 'input_image', image_url: 'data:${mimeType};base64,${data}' }`

因此当附件是 Markdown：
- 生成：`image_url = data:text/markdown;base64,...`
- OpenAI Responses 要求 `image_url` 必须是 `data:image/*;base64,...`
- 所以报错：`unsupported MIME type 'text/markdown'`

---

## 渠道对比：Gemini / Claude（Anthropic）是不是也这样？

### OpenAI (Chat Completions / 非 Responses)
- `backend/modules/channel/formatters/openai.ts:337`：
  - `inlineData` -> `image_url: { url: data:${mimeType};base64,... }`
  - **同样把任何 inlineData 当图片字段**
- 结果：如果附件是 `text/markdown`/`application/pdf`/音频/视频，都会被塞到 `image_url`，大概率同类报错。

### Anthropic (Claude)
- `backend/modules/channel/formatters/anthropic.ts:339`：
  - `inlineData` -> `type: 'image', source: { type: 'base64', media_type: mimeType, data }`
  - **同样把任何 inlineData 当 image block**（Anthropic 的消息多模态主要是图片）
- 结果：Markdown（`text/markdown`）也会作为 image block 的 `media_type` 发送，通常会被上游拒绝（取决于上游是否只接受图片 media_type）。

### Gemini
- `backend/modules/channel/formatters/gemini.ts:41` 起：
  - `buildRequest()` 基本是把标准化 `Content` 直接放入 `body.contents`。
  - 用户附件依然是 `inlineData: { mimeType: 'text/markdown', data: '...' }`（由 MessageBuilderService 生成）。
  - **Gemini 不会把 inlineData 强行映射成“图片字段”，而是原样传递 mimeType**。
- 结果：
  - Gemini 是否接受 `text/markdown` 取决于 Gemini API 对 `inlineData.mimeType` 的支持范围。
  - 就算不会出现“image_url 里塞 text/markdown”这种字段级错误，也可能出现“mimeType 不支持”的渠道级错误。

---

## 为什么这个问题会出现（设计层面的根因）

### A. “用户附件”与“多模态工具返回”的模型混在一起
- `MessageBuilderService` 把附件统一写入 `inlineData`，但不同渠道对多模态的表达差异很大：
  - OpenAI/Responses：图片用 `image_url` / `input_image`，文件应走 `input_file` 或“文本内容”
  - Anthropic：多模态主要是 `image` block
  - Gemini：`inlineData` 支持范围更广（但也不是无限）

### B. Formatter 层缺少“按 MIME 类型分流”的逻辑
- OpenAI / OpenAI Responses / Anthropic 的 formatter 都是：
  - `if (part.inlineData) => 直接当图片`
  - **没有根据 `mimeType` 做 image/document/text 的分流**

### C. ConversationManager 的多模态能力过滤不覆盖“用户附件”
- `backend/modules/conversation/ConversationManager.ts:802` 说明：
  - 多模态能力过滤策略只对“工具响应消息”生效
  - 用户主动提交附件不受多模态工具配置影响
- 这会导致：即使渠道本身不支持该类型附件，用户附件也会继续进入 formatter。

---

## 额外观察（与本问题强相关）

1) 前端允许 `.md` 被推断为 `text/markdown`（`frontend/src/utils/file.ts:32`），且验证逻辑不限制文件类型（仅限制大小）。
2) 后端多模态工具支持的文档类型列表并不包含 `text/markdown`：
   - `backend/tools/utils.ts:304` / `backend/modules/conversation/multimedia.ts:61`
   - 但该“支持列表”并未用于阻止用户附件进入 API 请求。
3) 前端的 `SUPPORTED_DOCUMENT_TYPES` 也不包含 `text/markdown`（`frontend/src/types/index.ts:581`），
  但由于 `getFileType()` 对 `text/*` 默认归类为 `code`，并不影响附件是否会被发送到后端；
  后端依旧会把该附件写入 `inlineData`。

---

## 当前判断（不改代码前提下）
- 这次 OpenAI 400 的原因可以确定：**Lim Code 把 markdown 的 base64 用 `input_image.image_url` 发给了 OpenAI Responses**。
- 上游错误是符合预期的校验失败。
- 同类风险在 OpenAI（非 Responses）与 Anthropic 同样存在；Gemini 虽不会“伪装成图片字段”，但仍可能因不支持 `text/markdown` 而失败。
