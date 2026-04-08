import type { APIGatewayProxyHandler } from "aws-lambda";
import { z } from "zod";

import { putTask } from "../lib/dynamo";
import { log } from "../lib/logger";
import { enqueueTask } from "../lib/sqs";
import { TaskStatus } from "../lib/types";

const requestSchema = z.object({
  taskId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(event.body ?? "{}");
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    const validation = requestSchema.safeParse(parsedBody);
    if (!validation.success) {
      return jsonResponse(400, {
        error: "Validation failed",
        details: validation.error.issues,
      });
    }

    const { taskId, payload } = validation.data;
    const now = new Date().toISOString();

    await putTask({
      taskId,
      payload,
      status: TaskStatus.PENDING,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await enqueueTask(taskId, payload);

    log("info", "task submitted", { taskId });

    return jsonResponse(202, { taskId, status: TaskStatus.PENDING });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log("error", "submitTask failed", { reason });

    return jsonResponse(500, { error: "Internal server error" });
  }
};
