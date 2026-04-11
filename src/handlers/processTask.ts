import type { SQSBatchResponse, SQSHandler } from "aws-lambda";

import { getTask, updateTaskStatus } from "../lib/dynamo";
import { log } from "../lib/logger";
import { enqueueTask } from "../lib/sqs";
import { TaskStatus } from "../lib/types";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const randomIntInclusive = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min + 1));

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    let taskId: string;
    let payload: Record<string, unknown>;
    try {
      const body = JSON.parse(record.body) as { taskId?: string; payload?: Record<string, unknown> };
      if (typeof body.taskId !== "string" || body.taskId.length === 0) {
        throw new Error("missing or invalid taskId in message body");
      }
      taskId = body.taskId;
      payload = body.payload ?? {};
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log("error", "invalid SQS message body", { reason });
      batchItemFailures.push({ itemIdentifier: record.messageId });
      continue;
    }

    log("info", "task processing started", { taskId });
    await updateTaskStatus(taskId, TaskStatus.PROCESSING);

    await sleep(randomIntInclusive(200, 800));

    const succeeded = Math.random() >= 0.3;

    if (succeeded) {
      await updateTaskStatus(taskId, TaskStatus.COMPLETED);
      log("info", "task completed", { taskId });
      continue;
    }

    const task = await getTask(taskId);
    const retryCount = task?.retryCount ?? 0;

    if (retryCount < 2) {
      await updateTaskStatus(taskId, TaskStatus.PENDING, { retryCount: retryCount + 1 });
      await enqueueTask(taskId, payload);
      log("warn", "task failed, will retry", { taskId, attempt: retryCount + 1 });
      continue;
    }

    await updateTaskStatus(taskId, TaskStatus.FAILED, {
      failureReason: "max retries exceeded",
    });
    log("error", "task permanently failed", { taskId });
  }

  return { batchItemFailures };
};
