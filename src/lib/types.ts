export enum TaskStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface Task {
  taskId: string;
  payload: Record<string, unknown>;
  status: TaskStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
}
