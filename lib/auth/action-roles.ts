import { UserRole } from "@/lib/enums"

/**
 * 开放协作模型（2026-06，与可见性反转 §3.3 配套）：内部提效系统，**操作类动作支持互相替班**。
 *
 * `staffRoles` = 全部在岗角色（除只读 `viewer`）。收样 / 实验全流程 / 质控 / 产出指标 /
 * 生信建单与执行 / 多模态确认 / 测序交付登记等"谁在干就谁记"的动作开放给全员。
 *
 * 仅「确实需要权限、不能随便替班」的管理决策仍锁角色（确认/交付/异常/终止/删项目=admin/PM；
 * 删除=admin；建项目=admin/PM/销售），见各 rules.ts；与本集正交。
 */
export const staffRoles = [
  UserRole.admin,
  UserRole.project_manager,
  UserRole.sales_owner,
  UserRole.sample_receiver,
  UserRole.lab_operator,
  UserRole.bioinfo_analyst,
] as const

/**
 * 在岗员工（除只读 viewer）即可执行操作类动作。
 * 用白名单 `staffRoles` 判定（非 `!== viewer` 黑名单）：将来新增角色时默认 fail-closed，
 * 不会因忘记更新而把新角色当成在岗员工放行。
 */
export function canActAsStaff(role: string | undefined): boolean {
  return !!role && (staffRoles as readonly string[]).includes(role)
}
