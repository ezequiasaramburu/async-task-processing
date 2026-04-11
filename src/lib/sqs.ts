import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

let _client: SQSClient | null = null;

const getClient = (): SQSClient => {
  if (!_client) {
    const isOffline = process.env.IS_OFFLINE === "true";
    _client = new SQSClient(
      isOffline ? { endpoint: process.env.SQS_ENDPOINT } : {}
    );
  }
  return _client;
};

const resolveQueueUrl = (): string => {
  const isOffline = process.env.IS_OFFLINE === "true";
  const envVar = isOffline ? "LOCAL_TASK_QUEUE_URL" : "TASK_QUEUE_URL";
  const queueUrl = process.env[envVar];
  if (!queueUrl) {
    throw new Error(`${envVar} environment variable is required`);
  }
  return queueUrl;
};


export const enqueueTask = async (taskId: string, payload: Record<string, unknown>): Promise<void> => {
  await getClient().send(
    new SendMessageCommand({
      QueueUrl: resolveQueueUrl(),
      MessageBody: JSON.stringify({ taskId, payload }),
    }),
  );
};
