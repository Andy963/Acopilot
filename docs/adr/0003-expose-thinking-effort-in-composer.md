# ADR 0003: Expose Thinking Effort in Composer

- Status: Accepted
- Date: 2026-01-29

## 背景

对于支持 reasoning 的模型（例如 OpenAI 兼容协议中的部分模型），`reasoning.effort` 是一个高频调参项：它会明显影响响应质量、延迟与成本。

如果该配置只存在于 Settings 深处，实际使用时会出现两个问题：

- 用户需要频繁进设置页面切换，交互成本高；
- 不同对话/任务对“思考强度”的偏好不同，缺少“就地快速切换”的入口。

因此需要在输入区（composer）提供一个低干扰的快速入口。

## 约束

- 只对支持该能力的 provider/model 展示，避免对其它渠道造成 UI 噪音。
- 在面板宽度较窄时不应导致输入区换行或溢出，应优先保证输入与发送动作的布局稳定。
- 切换必须真实影响请求参数：如果仅更新 `options.reasoning.effort` 但未启用 `optionsEnabled.reasoning`，会导致“看起来切换了但实际不生效”的误导。

## 决策

在输入区底部栏新增一个 `thinking effort` 下拉选择器：

- 仅在 OpenAI 协议且模型满足可见性条件时展示（避免对不支持 reasoning 的模型暴露无效选项）。
- 选项值固定为 `low` / `medium` / `high` / `xhigh`，并始终展示英文值以保持紧凑与可辨识。
- 在面板宽度不足时自动隐藏该选择器（通过运行时测量 footer 宽度与 actions 宽度判断），优先保证输入区主布局稳定。
- 当用户切换时，同时更新配置：
  - `options.reasoning.effort = <value>`
  - `optionsEnabled.reasoning = true`

## 后果

- 正向：
  - 将高频调参从 Settings 下沉到“就地快速切换”，显著降低操作成本；
  - 通过可见性条件与窄屏隐藏逻辑，避免引入额外 UI 噪音与布局抖动。
- 负向/风险：
  - 可见性判定依赖启发式（例如基于模型名/协议判断），后续可能需要补充规则以覆盖更多模型；
  - 窄屏隐藏阈值是经验值，可能需要随 UI 演进调整。

## 替代方案

- 仅在 Settings 中配置：实现简单但交互成本高，不满足高频切换需求。
- 始终展示并允许换行：会挤占输入空间，导致窄屏体验明显退化。
- 每次发送时在消息级别选择：更灵活但会显著增加输入区复杂度，也更难与配置持久化对齐。

## 实现参考

- 输入区展示与更新逻辑：`frontend/src/components/input/InputArea.vue`
- effort 选项与可见性判定：`frontend/src/utils/thinking.ts`

