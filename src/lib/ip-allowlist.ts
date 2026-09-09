/**
 * Проверка IP по списку сетей в нотации CIDR.
 *
 * Платёжные сервисы шлют уведомления с фиксированных адресов, и это
 * первый барьер перед обработкой такого запроса. Логика общая для всех
 * провайдеров, поэтому живёт отдельно от их клиентов.
 */

/** Дополнительные сети из переменной окружения (список CIDR через запятую). */
export function readExtraNetworks(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function ipInAnyCidr(ip: string, cidrs: string[]): boolean {
  return cidrs.some((cidr) => ipInCidr(ip, cidr))
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [range, prefixText] = cidr.split("/")
  if (!range) return false

  const prefixLength = prefixText === undefined ? null : Number(prefixText)

  const ipBytes = parseIp(ip)
  const rangeBytes = parseIp(range)

  if (!ipBytes || !rangeBytes) return false
  if (ipBytes.length !== rangeBytes.length) return false

  const bits =
    prefixLength === null || Number.isNaN(prefixLength)
      ? ipBytes.length * 8
      : prefixLength

  if (bits < 0 || bits > ipBytes.length * 8) return false

  const fullBytes = Math.floor(bits / 8)
  const remainderBits = bits % 8

  for (let i = 0; i < fullBytes; i++) {
    if (ipBytes[i] !== rangeBytes[i]) return false
  }

  if (remainderBits === 0) return true

  const mask = 0xff << (8 - remainderBits) & 0xff
  return (ipBytes[fullBytes] & mask) === (rangeBytes[fullBytes] & mask)
}

/** Разбирает IPv4/IPv6 в массив байт. Возвращает null для мусора. */
function parseIp(value: string): number[] | null {
  const address = value.trim()

  // IPv4-mapped IPv6, например ::ffff:185.71.76.1
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) return parseIpv4(mapped[1])

  if (address.includes(":")) return parseIpv6(address)
  return parseIpv4(address)
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".")
  if (parts.length !== 4) return null

  const bytes: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const byte = Number(part)
    if (byte > 255) return null
    bytes.push(byte)
  }
  return bytes
}

function parseIpv6(value: string): number[] | null {
  const halves = value.split("::")
  if (halves.length > 2) return null

  const toGroups = (text: string): number[] | null => {
    if (!text) return []
    const groups: number[] = []
    for (const group of text.split(":")) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
      groups.push(parseInt(group, 16))
    }
    return groups
  }

  const head = toGroups(halves[0])
  const tail = halves.length === 2 ? toGroups(halves[1]) : []

  if (!head || !tail) return null

  const missing = 8 - head.length - tail.length
  if (halves.length === 2) {
    if (missing < 0) return null
  } else if (missing !== 0) {
    return null
  }

  const groups = [...head, ...new Array(Math.max(missing, 0)).fill(0), ...tail]
  if (groups.length !== 8) return null

  return groups.flatMap((group) => [(group >> 8) & 0xff, group & 0xff])
}
