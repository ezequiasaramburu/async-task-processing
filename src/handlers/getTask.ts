import type { APIGatewayProxyHandler } from "aws-lambda";

import { getTask as fetchTask } from "../lib/dynamo";
import { log } from "../lib/logger";

const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const taskId = event.pathParameters?.taskId?.trim();
    if (!taskId) {
      return jsonResponse(400, { error: "Missing taskId" });
    }

    const task = await fetchTask(taskId);
    if (!task) {
      return jsonResponse(404, { error: "Task not found" });
    }

    const body: Record<string, unknown> = {
      taskId: task.taskId,
      status: task.status,
      retryCount: task.retryCount,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };

    if (task.failureReason !== undefined) {
      body.failureReason = task.failureReason;
    }

    return jsonResponse(200, body);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log("error", "getTask failed", { reason });
    return jsonResponse(500, { error: "Internal server error" });
  }
};
