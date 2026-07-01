/**
 * 「整块可点击」共用的忽略规则：点击落在真实交互元素上（链接/按钮/表单控件/菜单/弹层），
 * 或用户正在选中文本时，不触发整块软导航。ClickableRow / ClickableCard 共用同一份，
 * 避免选择器与选中文本守卫分散多处漂移。
 */
const INTERACTIVE_SELECTOR =
  "a,button,input,textarea,select,[role='menu'],[role='menuitem'],[role='dialog']"

export function isInteractiveOrSelectionClick(target: HTMLElement) {
  if (target.closest(INTERACTIVE_SELECTOR)) return true
  if (window.getSelection()?.toString()) return true
  return false
}
