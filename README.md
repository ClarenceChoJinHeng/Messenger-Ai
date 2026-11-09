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
| PATCH | `/users/me` | ✓ | Update username / display name / bio / theme |
| POST | `/account/email` | ✓ | Ask to change email: a confirmation link goes to the new address |
| POST | `/account/password` | ✓ | Ask to change password: a confirmation link goes to your email |
| POST | `/account/confirm` | – | The link's token confirms the change. A password change logs out every device |
| GET | `/contacts` | ✓ | My chat list: Sparky, people I added, and anyone who messaged me |
| POST | `/contacts` | ✓ | Add someone by their exact username (there's no public list of users) |
| DELETE | `/contacts/:userId` | ✓ | Remove someone from my list (messages stay) |
| GET | `/users/:username` | ✓ | Someone's public profile |
| GET | `/messages/conversations` | ✓ | My chats, newest first, with the last message and unread count |
| GET | `/messages/:userId` | ✓ | Messages between me and a user (marks theirs as read) |
| POST | `/messages/:userId` | ✓ | Send text and/or a photo/video (multipart, field `file`, max 25 MB). Sparky replies in the same response |
| GET | `/messages/attachment/:messageId` | ✓ | A photo/video, decrypted, only for the two people in that chat |

| PATCH | `/messages/item/:id` | ✓ | Edit my message's text (within 15 minutes) |
| DELETE | `/messages/item/:id` | ✓ | Unsend my message (file erased, shows "deleted") |
| PUT | `/messages/item/:id/reaction` | ✓ | React `{ emoji }` (same again removes it) |
| POST | `/contacts/requests/:userId/dismiss` | ✓ | Delete a message request (comes back if they write again) |
| GET · POST · DELETE | `/blocks` · `/blocks/:userId` | ✓ | List / block / unblock |
| POST · DELETE | `/users/me/avatar` | ✓ | Upload (max 5 MB) / remove my profile photo |
| GET | `/users/:id/avatar` | ✓ | Someone's profile photo (decrypted) |
| GET | `/notifications` | ✓ | The bell tray: `{ unread, items }` (messages grouped per sender) |
| POST | `/notifications/read-all` · `/notifications/:id/read` | ✓ | Mark as read |

**WebSocket** (Socket.IO, same port, `auth: { token }`; the token is checked during the handshake):
server → client `message`, `read`, `typing`, `presence`, `notifications`; client → server `typing { to, typing }`, `activity { state: active | idle }`.

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
| `JWT_SECRET` | recommended | Signs login tokens. Without it a development key is created in `secrets/` (git-ignored) |
| `MESSAGE_ENCRYPTION_KEY` | recommended | Encrypts messages and files. Without it a development key is created in `secrets/` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional | Sends confirmation emails. Without them, emails are printed in the terminal |
| `ANTHROPIC_API_KEY` | optional | Lets Sparky answer with Claude. Without it Sparky uses simple mode |
| `FRONTEND_URL` | optional | CORS origin, default `http://localhost:3000` |
| `PORT` | optional | Default `4000` |

## Tests

```bash
npm test        # unit tests (Sparky's commands + calculator, auth controller)
```

## Security

- **Encryption at rest**: message text and uploaded files are encrypted with AES-256-GCM (random IV per item, plus an auth tag, so tampering is detected). A copy of the database or the `uploads/` folder is unreadable without the key. This is not end-to-end encryption: the server can decrypt, which Sparky needs in order to reply.
- **Uploads**: the file type is detected from the bytes (not the name or the browser's claim), only photos/videos are allowed, files get random names, and they're only served to the two people in the chat.
- **Sessions**: JWTs carry a `tokenVersion`. Changing the password bumps it, so every existing login stops working.
- **Email/password changes** need the current password and a link from an email. Only a SHA-256 hash of the link's token is stored. Links expire after 1 hour and work once.
- **Rate limiting** (`@nestjs/throttler`): 10/min for login and sign-up, 5/min for account changes, 300/min overall.
- **Headers**: `helmet` (nosniff, frame protection, ...). CORS allows only the frontend's origin.

## Design notes

- **Passwords**: hashed with bcrypt. Login gives the same error for an unknown user and a wrong password, so attackers can't find out which accounts exist.
- **Validation**: DTOs with class-validator, and `whitelist: true` drops any extra fields, so mass assignment can't happen.
- **The AI as a user**: Sparky is a normal `User` row with `isBot = true`, so chatting with the AI reuses the same messaging code. Its username `ai` is shorter than the 3-letter minimum, so nobody can register it.
- **Calculator**: Sparky's simple-mode maths uses a small recursive-descent parser instead of `eval`, so user input is never run as code.
