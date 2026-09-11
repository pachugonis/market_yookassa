/**
 * Создание администратора или сброс его пароля.
 *
 *   npm run admin:create -- admin@example.com
 *
 * Email — первым аргументом или в ADMIN_EMAIL, имя — в ADMIN_NAME.
 * Пароль берётся из ADMIN_PASSWORD, иначе запрашивается в терминале
 * (ввод не отображается) либо читается первой строкой из stdin — так
 * его передаёт install.sh, чтобы пароль не светился в списке процессов.
 *
 * Если пользователь с таким email уже есть, он становится
 * администратором, а пароль заменяется на новый.
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Те же границы, что при регистрации
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 200

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    let value = ""

    const cleanup = () => {
      stdin.off("data", onData)
      stdin.setRawMode(false)
      stdin.pause()
      process.stdout.write("\n")
    }

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          cleanup()
          resolve(value)
          return
        }
        if (char === "") {
          cleanup()
          reject(new Error("Отменено"))
          return
        }
        if (char === "" || char === "\b") {
          value = value.slice(0, -1)
          continue
        }
        value += char
      }
    }

    process.stdout.write(question)
    stdin.setEncoding("utf8")
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on("data", onData)
  })
}

async function readFirstStdinLine(): Promise<string> {
  let data = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) {
    data += chunk
  }
  return data.split(/\r?\n/)[0] ?? ""
}

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD
  }

  if (!process.stdin.isTTY) {
    return readFirstStdinLine()
  }

  const password = await promptHidden("Пароль администратора: ")
  const confirmation = await promptHidden("Повторите пароль: ")
  if (password !== confirmation) {
    throw new Error("Пароли не совпадают")
  }
  return password
}

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase()
  const name = process.env.ADMIN_NAME?.trim() || "Администратор"

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error(
      "Укажите email администратора: npm run admin:create -- admin@example.com"
    )
  }

  const password = await readPassword()

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`
    )
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `Пароль должен быть не длиннее ${MAX_PASSWORD_LENGTH} символов`
    )
  }

  // Вход ищет пользователя без учёта регистра и отказывает, если
  // совпадений два, — здесь то же правило, чтобы не повысить до
  // администратора не тот аккаунт.
  const matches = await prisma.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    take: 2,
  })

  if (matches.length > 1) {
    throw new Error(
      `Найдено несколько аккаунтов, отличающихся только регистром email (${email}) — удалите лишний`
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const existing = matches[0]

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", password: passwordHash, verified: true },
    })
    console.log(
      `Пользователь ${existing.email} назначен администратором, пароль обновлён`
    )
  } else {
    await prisma.user.create({
      data: {
        email,
        name,
        password: passwordHash,
        role: "ADMIN",
        verified: true,
      },
    })
    console.log(`Администратор ${email} создан`)
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
