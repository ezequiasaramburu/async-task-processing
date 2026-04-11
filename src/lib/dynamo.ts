import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

import { Task, TaskStatus } from "./types";

let _client: DynamoDBClient | null = null;

const getClient = (): DynamoDBClient => {
  if (!_client) {
    const isOffline = process.env.IS_OFFLINE === "true";
    _client = new DynamoDBClient(
      isOffline ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}
    );
  }
  return _client;
};

const getTableName = (): string => {
  const name = process.env.TASKS_TABLE;
  if (!name) {
    throw new Error("TASKS_TABLE environment variable is required");
  }
  return name;
};

export const putTask = async (task: Task): Promise<void> => {
  await getClient().send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall(task, { removeUndefinedValues: true }),
    }),
  );
};

export const getTask = async (taskId: string): Promise<Task | null> => {
  const result = await getClient().send(
    new GetItemCommand({
      TableName: getTableName(),
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

  await getClient().send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: marshall({ taskId }),
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
    }),
  );
};
