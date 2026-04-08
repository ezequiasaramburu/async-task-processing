import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const isOffline = process.env.IS_OFFLINE === "true";
const queueUrl = process.env.TASK_QUEUE_URL;

if (!queueUrl) {
  throw new Error("TASK_QUEUE_URL environment variable is required");
}

const client = new SQSClient(
  isOffline
    ? {
        endpoint: "http://localhost:9324",
        region: "us-east-1",
        credentials: {
          accessKeyId: "fakeMyKeyId",
          secretAccessKey: "fakeSecretAccessKey",
        },
      }
    : {},
);

export const enqueueTask = async (taskId: string, payload: Record<string, unknown>): Promise<void> => {
  await client.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ taskId, payload }),
    }),
  );
};
