import Link from "next/link";
import {
  BIOINFO_SERVICE_LEVELS,
  EXPERIMENT_TASK_STATUS_LABELS,
  ExperimentTaskStatus,
  PROJECT_STATUS_LABELS,
  RESULT_STATUS_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type ResultStatus as ResultStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums";
import type { getExperimentTaskDetail } from "@/lib/experiment-tasks/service";
import { canActAsStaff } from "@/lib/auth/action-roles";
import { formatDate, formatDateTime, toDateString } from "@/lib/utils";
import { EditableSection } from "@/components/detail/editable-section";
import { WorkItemHeader } from "@/components/detail/work-item-header";
import { ExperimentTaskPrimaryAction } from "@/components/experiment-tasks/experiment-task-primary-action";
import { QcSection } from "@/components/experiment-tasks/qc-section";
import { RunMetricsSection } from "@/components/experiment-tasks/run-metrics-section";
import { pickRunMetrics } from "@/components/experiment-tasks/run-metrics";
import type {
  FeedbackAnalystOption,
  OperatorOption,
} from "@/components/experiment-tasks/types";
import { UploadRecordButton } from "@/components/experiment-records/upload-record-button";
import { canUploadRecord } from "@/lib/experiment-records/permissions";
import { EXPERIMENT_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot";
import { Separator } from "@/components/ui/separator";

type ExperimentTaskDetail = Awaited<ReturnType<typeof getExperimentTaskDetail>>;

/** 终局状态：无需主动作，开放修正入口 */
const EXPERIMENT_TERMINAL_STATUSES = new Set<ExperimentTaskStatusValue>([
  ExperimentTaskStatus.completed,
  ExperimentTaskStatus.cancelled,
  ExperimentTaskStatus.abnormal,
]);

export function ExperimentTaskWorkItemBody({
  detail,
  role,
  operatorOptions,
  analystOptions,
}: {
  detail: ExperimentTaskDetail;
  role?: string;
  operatorOptions: OperatorOption[];
  analystOptions: FeedbackAnalystOption[];
}) {
  const { task } = detail;
  const status = task.status as ExperimentTaskStatusValue;
  const project = task.project;
  const projectStatus = project.status as ProjectStatusValue;
  const editable = canActAsStaff(role);
  const isTerminal = EXPERIMENT_TERMINAL_STATUSES.has(status);
  const showPrimaryAction =
    editable &&
    (status === ExperimentTaskStatus.waiting_schedule ||
      status === ExperimentTaskStatus.scheduled ||
      status === ExperimentTaskStatus.in_progress ||
      status === ExperimentTaskStatus.waiting_feedback);
  const endpoint = `/api/experiment-tasks/${task.id}`;
  const plannedDateValue = toDateString(task.plannedDate);
  const actualDateValue = toDateString(task.actualDate);
  const leaves = task.taskSamples.map((ts) => ts.sample);
  const first = leaves[0];
  const sampleNames =
    leaves.map((s) => s.sampleName || "未命名").join("、") || "-";
  const operatorOptionsForSelect = operatorOptions.map((operator) => ({
    value: operator.id,
    label: operator.department
      ? `${operator.name} · ${operator.department}`
      : operator.name,
  }));
  const taskInfoFields = [
    {
      name: "sampleNames",
      label: "样本名",
      displayValue: sampleNames,
      editable: false,
      multiline: true,
    },
    {
      name: "speciesAndTissue",
      label: "物种 / 组织",
      displayValue: first
        ? `${first.species ?? "-"} · ${first.tissueType ?? "-"}`
        : "-",
      editable: false,
    },
    {
      name: "experimentType",
      label: "实验类型",
      value: task.experimentType,
      required: true,
      placeholder: "组织解离 / 建库 / 上机…",
    },
    {
      name: "runMethod",
      label: "上机方式",
      value: task.runMethod,
      placeholder: "GEM-X / Chromium…",
    },
    {
      name: "plannedDate",
      label: "计划实验日期",
      value: plannedDateValue,
      displayValue: plannedDateValue ? formatDate(task.plannedDate) : null,
      type: "date" as const,
    },
    {
      name: "actualDate",
      label: "实际实验日期",
      displayValue: formatDate(task.actualDate),
      editable: false,
    },
    {
      name: "operatorId",
      label: "实验负责人",
      value: task.operatorId,
      displayValue: task.operator?.name,
      type: "select" as const,
      options: operatorOptionsForSelect,
      placeholder: "选择负责人",
    },
    {
      name: "department",
      label: "所属部门",
      value: task.department,
      placeholder: "实验部 / 时空部…",
    },
    {
      name: "sampleCount",
      label: "样本数",
      displayValue: task.taskSamples.length,
      editable: false,
    },
    {
      name: "resultStatus",
      label: "结果状态",
      displayValue: task.resultStatus
        ? RESULT_STATUS_LABELS[task.resultStatus as ResultStatusValue]
        : "-",
      editable: false,
    },
    {
      name: "createdAt",
      label: "创建时间",
      displayValue: formatDateTime(task.createdAt),
      editable: false,
    },
    {
      name: "resultFeedback",
      label: "结果反馈",
      displayValue: task.resultFeedback,
      editable: false,
      multiline: true,
      span: "full" as const,
    },
  ];

  return (
    <>
      <WorkItemHeader
        title={task.taskNo}
        statusLabel={EXPERIMENT_TASK_STATUS_LABELS[status]}
        statusDotClassName={EXPERIMENT_TASK_STATUS_DOT[status]}
        project={{
          id: project.id,
          projectNo: project.projectNo,
          customerOrg: project.customerOrg,
          statusLabel: PROJECT_STATUS_LABELS[projectStatus],
        }}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-5">
          {showPrimaryAction && (
            <>
              <ExperimentTaskPrimaryAction
                taskId={task.id}
                taskNo={task.taskNo}
                status={status}
                plannedDate={plannedDateValue}
                actualDate={actualDateValue}
                operatorId={task.operatorId}
                runMethod={task.runMethod}
                department={task.department}
                operatorOptions={operatorOptions}
                bioinfoEnabled={BIOINFO_SERVICE_LEVELS.includes(
                  task.project.serviceLevel as ServiceLevelValue,
                )}
                analystOptions={analystOptions}
              />
              <Separator />
            </>
          )}

          <EditableSection
            title={isTerminal ? "修正信息" : "任务信息"}
            endpoint={endpoint}
            fields={taskInfoFields}
            editable={isTerminal && editable}
            editLabel="修正"
            successMessage="任务信息已保存"
          />

          <Separator />
          <QcSection
            taskId={task.id}
            taskNo={task.taskNo}
            status={status}
            role={role}
            records={task.qcRecords}
          />
          <Separator />
          <RunMetricsSection
            experimentTaskId={task.id}
            taskNo={task.taskNo}
            status={status}
            role={role}
            metrics={pickRunMetrics(task.taskSamples)}
          />
          {canUploadRecord(status, role) && (
            <>
              <Separator />
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">实验记录</h3>
                  <UploadRecordButton taskId={task.id} />
                </div>
                <p className="text-xs text-muted-foreground">
                  上传上机实验记录照片，自动识别样本名与质控指标，人工核对确认后写入。
                </p>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
