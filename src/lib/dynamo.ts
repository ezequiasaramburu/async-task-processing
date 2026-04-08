import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

import { Task, TaskStatus } from "./types";

const isOffline = process.env.IS_OFFLINE === "true";
const tableName = process.env.TASKS_TABLE;

if (!tableName) {
  throw new Error("TASKS_TABLE environment variable is required");
}

const client = new DynamoDBClient(
  isOffline
    ? {
        endpoint: "http://localhost:8000",
        region: "us-east-1",
        credentials: {
          accessKeyId: "fakeMyKeyId",
          secretAccessKey: "fakeSecretAccessKey",
        },
      }
    : {},
);

export const putTask = async (task: Task): Promise<void> => {
  await client.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(task, { removeUndefinedValues: true }),
    }),
  );
};

export const getTask = async (taskId: string): Promise<Task | null> => {
  const result = await client.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ taskId }),
    }),
  );

  if (!result.Item) {
    return null;
  }

  return unmarshall(result.Item) as Task;
};

interface UpdateTaskStatusExtra {
  retryCount?: number;
  failureReason?: string;
}

export const updateTaskStatus = async (
  taskId: string,
  status: TaskStatus,
  extra: UpdateTaskStatusExtra = {},
): Promise<void> => {
  const names: Record<string, string> = {
    "#status": "status",
    "#updatedAt": "updatedAt",
  };
  const values: Record<string, unknown> = {
    ":status": status,
    ":updatedAt": new Date().toISOString(),
  };

  const setExpressions = ["#status = :status", "#updatedAt = :updatedAt"];

  if (typeof extra.retryCount === "number") {
    names["#retryCount"] = "retryCount";
    values[":retryCount"] = extra.retryCount;
    setExpressions.push("#retryCount = :retryCount");
  }

  if (typeof extra.failureReason === "string") {
    names["#failureReason"] = "failureReason";
    values[":failureReason"] = extra.failureReason;
    setExpressions.push("#failureReason = :failureReason");
  }

  await client.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ taskId }),
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
    }),
  );
};
