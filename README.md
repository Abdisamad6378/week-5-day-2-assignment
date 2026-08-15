# Week 5 Day 2 Assignment — Express Middleware

A small Express.js API that puts the three most essential Express concepts to work: **custom logging**, **API key authentication**, and **centralized error handling**.

The API is a simple "cities" catalogue built in-memory. It has a couple of public endpoints and a couple of protected ones, so you can actually see the middleware doing its job instead of just reading about it.

## Table of Contents

- [What's Inside](#whats-inside)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [How Each Task Was Implemented](#how-each-task-was-implemented)
  - [Task 1: Logging Middleware](#task-1-logging-middleware)
  - [Task 2: Authentication Middleware](#task-2-authentication-middleware)
  - [Task 3: Centralized Error Handling](#task-3-centralized-error-handling)
- [API Reference](#api-reference)
- [Testing with cURL](#testing-with-curl)
- [Log Format](#log-format)
- [Environment Variables](#environment-variables)

---

## What's Inside

| Feature | Description |
| --- | --- |
| **Request logging** | Every request is logged with a timestamp, method, path, status code and response time. Request bodies are logged for `POST`/`PUT`/`PATCH`, with any `password` field masked. |
| **API key auth** | Protected routes require an `x-api-key` header. Missing it gives a clear 401, a wrong key also gives a 401, and only the valid key gets through. |
| **Centralized errors** | All errors funnel into one error handler that returns a consistent JSON shape, never leaking internal details to clients. |
| **Express 5** | Built on `express@^5.2.1`, using async-friendly error propagation (`throw` inside handlers is caught automatically). |

---

## Project Structure

```text
week-5-day-2-assignment/
├── middleware/
│   ├── logger.js          # Task 1 — logs every request
│   ├── auth.js            # Task 2 — x-api-key authentication
│   └── errorHandler.js    # Task 3 — AppError class + centralized handler
├── server.js              # Express app, routes, middleware wiring
├── package.json
└── tasks.md               # Original assignment file
```

---

## Getting Started

Make sure you have [Node.js](https://nodejs.org) installed (v18+ recommended).

```bash
# 1. Install dependencies
npm install

# 2. Start the server
node server.js
```

You should see:

```text
Server running on http://localhost:3000
```

The server has no database — the `cities` array lives in memory, so data resets every time you restart it. That's intentional; it keeps the focus on the middleware.

---

## How Each Task Was Implemented

### Task 1: Logging Middleware

**File:** `middleware/logger.js`

The logger records the start time (`Date.now()`), then listens for the `"finish"` event on the response. That event fires only after the response has been sent, which is the right moment to read the final status code and compute the response time.

```js
app.use(express.json());   // parsed body must exist before we log it
app.use(logger);           // runs for every request
```

For `POST`, `PUT` and `PATCH` requests it also logs the parsed request body. Sensitive fields are masked by recursively copying the body and replacing any key that contains `password` (case-insensitive) with `"***"` — without mutating the original body, so downstream handlers still see the real value.

### Task 2: Authentication Middleware

**File:** `middleware/auth.js`

Protecting a route is a one-liner — just drop the middleware in front of the handler:

```js
app.post("/api/cities", auth, ...);
```

The middleware:

1. Reads the `x-api-key` header.
2. If it's missing → `401 { error: "API key required. Include x-api-key header." }`
3. If it doesn't match the secret → `401 { error: "Invalid API key" }`
4. Otherwise calls `next()` and the route runs normally.

The API key is hardcoded for the assignment: `mctaba-2026-secret-key`.

**Route access policy:**

| Route | Access |
| --- | --- |
| `GET /api/cities` | ✅ Public |
| `GET /api/health` | ✅ Public |
| `POST /api/cities` | 🔒 Protected |
| `DELETE /api/cities/:id` | 🔒 Protected |

### Task 3: Centralized Error Handling

**File:** `middleware/errorHandler.js`

Two exports live in this file:

- **`AppError`** — a custom `Error` subclass carrying a `statusCode` and an `isOperational` flag. Throwing one signals "I meant to do this."
- **`errorHandler`** — the four-argument error middleware (Express recognizes it by the 4 params).

```js
app.use(errorHandler);   // always registered last
```

How it decides the response:

| Situation | Status | Message |
| --- | --- | --- |
| `AppError` instance | `err.statusCode` | `err.message` (e.g. `"City not found"`) |
| Any other error | `500` | `"Something went wrong"` — never the raw stack/internal details |

Every response has the same shape: `{ success: false, error: { message, statusCode } }`. When `NODE_ENV=development`, a `stack` field is added for debugging, so you get detail locally without exposing it in production.

The `AppError` is used in two places in `server.js`:

```js
if (!city) throw new AppError("City not found", 404);
app.delete("/api/cities/:id", auth, (req, res) => { ... throw new AppError("City not found", 404); });
```

A catch-all 404 handler forwards unmatched routes to the error handler as a generic `Error`, producing the 500 response for unknown paths.

---

## API Reference

### `GET /api/health`

Public. Simple liveness check.

**Response `200`:**
```json
{ "status": "ok" }
```

### `GET /api/cities`

Public. Lists all cities.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Nairobi", "county": "Nairobi" },
    { "id": 2, "name": "Mombasa", "county": "Mombasa" }
  ]
}
```

### `GET /api/cities/:id`

Public. Returns a single city by numeric id.

- **`200`** — city found: `{ "success": true, "data": { ... } }`
- **`404`** — no such city: `{ "success": false, "error": { "message": "City not found", "statusCode": 404 } }`

### `POST /api/cities`

🔒 **Protected.** Adds a city. Requires the `x-api-key` header and a JSON body.

**Request:**

```bash
curl -X POST http://localhost:3000/api/cities \
  -H "Content-Type: application/json" \
  -H "x-api-key: mctaba-2026-secret-key" \
  -d '{"name":"Nanyuki","county":"Laikipia"}'
```

**Response `201`:**
```json
{ "success": true, "data": { "id": 3, "name": "Nanyuki", "county": "Laikipia" } }
```

### `DELETE /api/cities/:id`

🔒 **Protected.** Removes a city by numeric id.

- **`200`** — removed: `{ "success": true, "data": { ... } }`
- **`404`** — no such city (AppError)
- **`401`** — missing/wrong API key

---

## Testing with cURL

Start the server, then run these from a second terminal:

```bash
# Public — works with no key at all
curl http://localhost:3000/api/cities

# Health check — also public
curl http://localhost:3000/api/health

# Protected — 401 because there's no key
curl -X POST http://localhost:3000/api/cities

# Protected — 401 because the key is wrong
curl -X POST http://localhost:3000/api/cities -H "x-api-key: nope"

# Protected — 201, it goes through
curl -X POST http://localhost:3000/api/cities \
  -H "Content-Type: application/json" \
  -H "x-api-key: mctaba-2026-secret-key" \
  -d '{"name":"Nanyuki","county":"Laikipia"}'

# Error handling — 404 via AppError
curl http://localhost:3000/api/cities/999

# Error handling — 500 via the catch-all
curl http://localhost:3000/api/broken-route
```

---

## Log Format

Every request produces one line on the server console:

```text
[2026-08-15T11:30:23.689Z] GET /api/cities 200 - 22ms
[2026-08-15T11:30:23.825Z] POST /api/cities 201 - 2ms {"name":"Nanyuki","county":"Laikipia"}
[2026-08-15T11:30:23.936Z] POST /api/broken 500 - 2ms {"email":"user@test.com","password":"***"}
```

Field by field:

1. **Timestamp** — ISO 8601 (`new Date().toISOString()`)
2. **Method** — `GET`, `POST`, `DELETE`, etc.
3. **Path** — `req.originalUrl`
4. **Status code** — read from `res.statusCode` in the `finish` handler
5. **Response time** — elapsed milliseconds, `Date.now()` start → `finish`
6. **Body** *(POST/PUT/PATCH only, if present)* — `password` fields shown as `***`

---

## Environment Variables

| Variable | Effect |
| --- | --- |
| `NODE_ENV` | When set to `development`, error responses include a `stack` trace. |

Example:

```bash
NODE_ENV=development node server.js
```

---

## Notes & Limitations

- The API key is **hardcoded** to match the assignment spec. In a real app it would live in an environment variable and be stored/compared with a hashing scheme.
- Cities are stored **in memory** — restart the server and they're gone.
- There is no `npm start` script on purpose; the simplest way to run it is `node server.js`. Add `"start": "node server.js"` to `package.json` scripts if you'd like one.

---

Built with Express 5 as part of the Week 5 Day 2 assignment. Each task was developed and committed in two steps — middleware first, wiring second — to keep the history easy to follow.