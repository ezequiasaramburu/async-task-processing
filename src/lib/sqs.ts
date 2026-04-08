import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const isOffline = process.env.IS_OFFLINE === "true";

const client = new SQSClient(
  isOffline
    ? {
        endpoint: process.env.SQS_ENDPOINT ?? "http://localhost:9324",
        region: process.env.AWS_REGION ?? "us-east-1",
        credentials: {
          accessKeyId: "fakeMyKeyId",
          secretAccessKey: "fakeSecretAccessKey",
        },
      }
    : {},
);

const resolveQueueUrl = (): string => {
  if (isOffline) {
    const queueName = process.env.TASK_QUEUE_NAME;
    if (!queueName) {
      throw new Error("TASK_QUEUE_NAME is required when running with IS_OFFLINE");
    }
    const accountId = process.env.ELASTICMQ_ACCOUNT_ID ?? "000000000000";
    const base = process.env.SQS_ENDPOINT ?? "http://localhost:9324";
    return `${base.replace(/\/$/, "")}/${accountId}/${queueName}`;
  }

  const queueUrl = process.env.TASK_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("TASK_QUEUE_URL environment variable is required");
  }

  return queueUrl;
};

export const enqueueTask = async (taskId: string, payload: Record<string, unknown>): Promise<void> => {
  await client.send(
    new SendMessageCommand({
      QueueUrl: resolveQueueUrl(),
      MessageBody: JSON.stringify({ taskId, payload }),
    }),
  );
};
