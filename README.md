# API Tests

API testing for **Fake REST API** [Users](https://fakerestapi.azurewebsites.net/swagger/v1/swagger.json) endpoints. Postman/Newman collection with two modules: **Atomic** (per-endpoint tests) and **E2E Flow**. Uses variables, response reuse, schema validation, and a mocked Bearer token.

## Contents

| Tool            | Folder    | Status      |
|-----------------|-----------|-------------|
| Postman / Newman | [postman/](postman/) | Implemented |

---

## Quick start (Postman UI)

1. Import into Postman:
   - **Collection**: [postman/FakeRESTAPI-Users.postman_collection.json](postman/FakeRESTAPI-Users.postman_collection.json)
   - **Environment**: [postman/postman_environment.json](postman/postman_environment.json)
2. Select the environment and run the collection (or a single folder).

The collection works immediately after import.

## Quick start (Newman CLI)

```bash
cd api-tests
npm install
npm run test:postman
```

Open `reports/newman/report.html` for the HTML report.

---

## Variables

### Environment (postman_environment.json)

| Variable    | Purpose                                                                 |
|-------------|-------------------------------------------------------------------------|
| `baseUrl`   | API base URL (default `https://fakerestapi.azurewebsites.net`)         |
| `authToken` | Mock Bearer token. Default `mock-jwt-token-2025`.                        |

### Collection-level (defaults, some set by scripts)

| Variable              | Purpose                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| `baseUrl`             | Fallback base URL (env overrides when present)                          |
| `authToken`           | Fallback mock token (env overrides when present)                        |
| `userId`              | Set from POST response; reused in GET/PUT/DELETE                        |
| `userName`, `password`| Generated in pre-request for POST/PUT payloads                           |
| `randomIdInRange`     | Random int in `[idMin, idMax]` for boundary/equivalence tests            |
| `idMin`, `idMax`      | Bounds for random id (default 1–100)                                     |
| `firstUserIdFromList` | Optional; set from first element of GET /Users (fallback when POST returns id 0) |

## Headers

- **Accept**: `application/json; v=1.0` – set on every request.
- **Content-Type**: `application/json; v=1.0` – on every POST and PUT with a JSON body.
- **Authorization**: `Bearer <authToken>` – set when `authToken` is defined.

---

## Modules

### Users – Atomic

- **GET /api/v1/Users** – list (200, array); schema validation; optionally sets `firstUserIdFromList`.
- **POST /api/v1/Users** – create (200); sets `userId`; validates User schema and returned userName.
- **GET /api/v1/Users/{{userId}}** – get created user (200); schema validation.
- **GET /api/v1/Users/{{randomIdInRange}}** – equivalence (200 or 404).
- **GET /api/v1/Users/1** – boundary positive (200 or 404).
- **GET /api/v1/Users/0** – boundary negative (404/400).
- **GET /api/v1/Users/999999** – negative (404).
- **PUT /api/v1/Users/{{userId}}** – update (200); schema and userName prefix assertion.
- **PUT /api/v1/Users/999999** – negative (404/200).
- **DELETE /api/v1/Users/{{userId}}** – delete (200).
- **DELETE /api/v1/Users/999999** – negative (404/200).

Run the folder top-to-bottom so POST runs before GET/PUT/DELETE by `userId`.

### Users – E2E Flow

Single flow: **POST → GET → PUT → GET (verify update) → DELETE → GET (404)**. All use `{{userId}}` from the POST in step 1. Step 4 asserts userName is present; if the API persists PUT, it also asserts `userName === 'e2e_updated'`. Can be run standalone. This folder is used as the **smoke** suite in CI.

---

## Scripts (Newman)

| Script                    | Description |
|---------------------------|-------------|
| `npm run test:postman`    | Full collection (Atomic + E2E) |
| `npm run test:postman:ci` | Full collection with `--ci` (bail on first failure); used by **Regression** workflow |
| `npm run test:postman:smoke:ci` | E2E Flow folder only with `--ci`; used by **Smoke** workflow |
| `npm run test:postman:atomic`   | Users – Atomic folder only |
| `npm run test:postman:e2e`     | Users – E2E Flow folder only |

Pass a folder explicitly:

```bash
node --no-deprecation scripts/run-newman.js --folder "Users – E2E Flow"
```

**Reports:** `reports/newman/report.html`, `reports/newman/junit.xml`, `reports/newman/coverage-summary.txt`.

Direct Newman:

```bash
npx newman run postman/FakeRESTAPI-Users.postman_collection.json \
  -e postman/postman_environment.json \
  --reporters cli,htmlextra,junit \
  --reporter-htmlextra-export reports/newman/report.html \
  --reporter-junit-export reports/newman/junit.xml
```

---

## CI (GitHub Actions)

Workflows in [.github/workflows/](.github/workflows/):

| Workflow   | File | Trigger                    | Command |
|------------|------|----------------------------|---------|
| **Smoke**  | [smoke.yml](.github/workflows/smoke.yml) | Push to `main`/`master`, or manual | `npm run test:postman:smoke:ci` |
| **Regression** | [regression.yml](.github/workflows/regression.yml) | Manual only | `npm run test:postman:ci` |

Each workflow installs deps, runs Newman, publishes test results (JUnit), and uploads `reports/newman/` as an artifact. **Secrets** (optional): `BASE_URL`, `AUTH_TOKEN`. For manual runs: **Actions** → select workflow → **Run workflow**.

---

## Coverage matrix (endpoint × scenario)

| Endpoint                  | Scenario  | Request name (Atomic / E2E) |
|---------------------------|-----------|-----------------------------|
| GET /api/v1/Users         | positive  | GET Users (list) – positive |
| POST /api/v1/Users        | positive  | POST User – positive, 1. POST User |
| GET /api/v1/Users/{id}    | positive  | GET User by id (userId from POST), 2. GET User by id, 4. GET User by id (verify update) |
| GET /api/v1/Users/{id}    | boundary  | GET User by id=1, GET User by randomIdInRange |
| GET /api/v1/Users/{id}    | negative  | GET User by id=0, GET User by id=999999, 6. GET User by id (expect 404) |
| PUT /api/v1/Users/{id}    | positive  | PUT User by userId, 3. PUT User |
| PUT /api/v1/Users/{id}    | negative  | PUT User by id=999999 |
| DELETE /api/v1/Users/{id} | positive  | DELETE User by userId, 5. DELETE User |
| DELETE /api/v1/Users/{id} | negative  | DELETE User by id=999999 |

All five endpoints are covered by at least one positive and, where applicable, negative/boundary request. Summary is written to `reports/newman/coverage-summary.txt` after each run.
