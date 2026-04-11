# Async Task Processor

A serverless asynchronous task processing service built on AWS. Tasks are submitted via HTTP, queued in SQS, and processed by Lambda workers with automatic retry logic.

## Prerequisites

- Node.js 20+
- Docker (for local DynamoDB and ElasticMQ)
- AWS CLI (for deployment only)
- Serverless Framework v3 (`npm install -g serverless@3` + `sls login`)

## How to Run Locally

1. Copy the environment file and start local services:

```bash
cp .env.example .env
docker compose up -d
```

2. Start the offline server:

```bash
npm run dev
```

3. Submit a task:

```bash
curl -X POST http://localhost:3000/dev/tasks \
  -H "Content-Type: application/json" \
  -d '{"taskId":"test-001","payload":{"foo":"bar"}}'
```

Expected response (HTTP 202):

```json
{ "taskId": "test-001", "status": "PENDING" }
```

4. Check task status:

```bash
curl http://localhost:3000/dev/tasks/test-001
```

Poll until status is `COMPLETED` or `FAILED`.

## Deploy to AWS

```bash
npx sls deploy --stage prod
```

## Architecture

```
Client
  |
  v
API Gateway  -->  submitTask Lambda  -->  SQS Queue  -->  processTask Lambda
                       |                                        |
                       v                                        v
                   DynamoDB  <----------------------------------+
                                                                |
                                                          (on failure)
                                                                |
                                                           SQS retries
                                                                |
                                                        DLQ (after 3 attempts)
```

1. **POST /tasks** validates input (Zod), writes the task to DynamoDB as `PENDING`, and enqueues a message to SQS.
2. **processTask** picks up messages from SQS, simulates work (200-800ms), and randomly fails ~30% of tasks.
3. **GET /tasks/:taskId** returns the current state of any task.

All infrastructure is defined in `serverless.yml` (DynamoDB table, SQS queue, DLQ). Local development uses DynamoDB Local and ElasticMQ via Docker.

## Retry Strategy

Retries are handled through a combination of SQS and application-level tracking:

- When a task fails, its `retryCount` is incremented in DynamoDB, the task is set back to `PENDING`, and a new message is enqueued to SQS for retry.
- If `retryCount >= 2`, the task is marked as `FAILED` with a `failureReason` — no re-enqueue happens.
- The SQS queue has a `RedrivePolicy` with `maxReceiveCount: 3`. If the handler crashes or times out (unexpected failures), SQS moves the message to the Dead Letter Queue.

In short: expected failures are tracked in DynamoDB and resolved gracefully. Unexpected failures are caught by the DLQ.

## Known Limitations

- **No authentication** on API endpoints.
- **No idempotency check** on task submission — submitting the same `taskId` twice overwrites the first task.
- **No IAM least-privilege policy** — relies on the default Lambda execution role. A production deployment should scope permissions to the specific DynamoDB table and SQS queue.
- **No unit or integration tests.**
- **Local retry limitations** — `serverless-offline-sqs` does not fully simulate SQS retry delivery or DLQ behavior. Full retry/DLQ flow can only be verified on deployed AWS infrastructure.
- **Processing logic is simulated** — the worker sleeps for a random duration and fails randomly. Real tasks would replace this with actual business logic.
