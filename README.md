# Messenger AI · API

The **backend** for Messenger AI: a NestJS REST API with MySQL (via Prisma), JWT authentication, one-on-one messaging, and an AI assistant ("Sparky") that answers with Claude.

The frontend (Next.js) lives in a separate repo.

## Stack

NestJS 12 (ESM) · Prisma 7 with the MariaDB driver adapter · MySQL · class-validator · `@nestjs/jwt` · bcryptjs · `@anthropic-ai/sdk` · Vitest

## API

| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/auth/register` | – | Create an account. Duplicate username/email → 409 |
| POST | `/auth/login` | – | Log in with username **or** email → `{ accessToken, user }` |
| GET | `/users/me` | ✓ | My profile |
| PATCH | `/users/me` | ✓ | Update display name / bio |
| GET | `/users` | ✓ | Everyone I can chat with (Sparky first) |
| GET | `/users/:username` | ✓ | Someone's public profile |
| GET | `/messages/conversations` | ✓ | My chats, newest first, with the last message |
| GET | `/messages/:userId` | ✓ | Messages between me and a user |
| POST | `/messages/:userId` | ✓ | Send a message. If it's to Sparky, the reply comes back in the same response |

Protected routes expect `Authorization: Bearer <token>`. No route ever returns a password, because every query selects only public columns.

## Project layout

```
src/
  auth/       register, login, JWT guard, @CurrentUser() decorator
  users/      profiles
  messages/   conversations + sending (asks the AI service when the receiver is the bot)
  ai/         Sparky: Claude when ANTHROPIC_API_KEY is set, otherwise simple built-in commands
  prisma/     PrismaService (PrismaClient + MariaDB adapter), shared through a global module
prisma/
  schema.prisma   User + Message models
  migrations/
```

## Run it locally

You need Node 20+ and a MySQL server (I use Laragon).

```bash
npm install
cp .env.example .env          # then fill in your values
npx prisma migrate dev        # creates the tables
npx prisma generate           # generates the typed client
npm run start:dev             # http://localhost:4000
```

### Environment variables (`.env`)

| Name | Required | What it's for |
|---|---|---|
| `DATABASE_URL` | yes | `mysql://USER:PASSWORD@localhost:3306/messenger_ai` |
| `JWT_SECRET` | recommended | Signs login tokens. Without it a temporary one is used, and everyone is logged out on restart |
| `ANTHROPIC_API_KEY` | optional | Lets Sparky answer with Claude. Without it Sparky uses simple mode |
| `FRONTEND_URL` | optional | CORS origin, default `http://localhost:3000` |
| `PORT` | optional | Default `4000` |

## Tests

```bash
npm test        # unit tests (Sparky's commands + calculator, auth controller)
```

## Design notes

- **Passwords**: hashed with bcrypt. Login gives the same error for an unknown user and a wrong password, so attackers can't find out which accounts exist.
- **Validation**: DTOs with class-validator, and `whitelist: true` drops any extra fields, so mass assignment can't happen.
- **The AI as a user**: Sparky is a normal `User` row with `isBot = true`, so chatting with the AI reuses the same messaging code. Its username `ai` is shorter than the 3-letter minimum, so nobody can register it.
- **Calculator**: Sparky's simple-mode maths uses a small recursive-descent parser instead of `eval`, so user input is never run as code.
