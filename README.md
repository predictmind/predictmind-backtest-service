# predictmind-backtest-service

PredictMind **backtest** microservice - Backtesting engine and performance metrics.

Part of the PredictMind platform (microservices architecture). Product and
architecture documentation lives in the private
[`predictmind/app`](https://github.com/predictmind/app) repository.

## Tech stack

- NestJS + TypeScript
- Default port: `3006` (overridable via `PORT`)
- Routed through the API gateway under `/api/v1/backtest`

## Getting started

```bash
npm install
npm run start:dev
```

Health check: `GET /api/v1/health`.

## Docker

```bash
docker build -t predictmind-backtest-service .
docker run -p 3006:3006 predictmind-backtest-service
```

## Quality & security

CI (lint + test + build), CodeQL code scanning, and Dependabot run on every push and PR.

## License

Proprietary - (c) PredictMind. All rights reserved.