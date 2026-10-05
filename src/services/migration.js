// 家庭成员数据迁移：把历史自由文本（holder / borrower / insured）尽量归并到真实成员。
// 归并规则：
//   1. 规范化（去空白、括号等）后与成员姓名/别名精确匹配；
//   2. 文本中只包含某一位成员的姓名/别名时（如“林小满（本人）”）归并给该成员；
//   3. 家庭共用文本（如“林家”“全家”）或同时出现多位成员的，不归并，原文本保留在记录上。
// 迁移是幂等的：已存在 members / 已写入成员 id 的数据不会被重复处理。

export const CURRENT_VERSION = 2

const FAMILY_TOKENS = /(全家|家庭|一家人|夫妻|夫妇|共用)/

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[\s　]/g, '')
    .replace(/[()（）\[\]【】「」"'’]/g, '')
}

export function matchMember(rawText, members) {
  const text = normalizeName(rawText)
  if (!text || FAMILY_TOKENS.test(text)) return null
  const aliases = members
    .flatMap((member) =>
      [member.name, ...(member.aliases ?? [])].map((name) => ({ id: member.id, name: normalizeName(name) })),
    )
    .filter((entry) => entry.name.length >= 2)
  const exact = aliases.find((entry) => entry.name === text)
  if (exact) return members.find((member) => member.id === exact.id)
  const owners = new Set(aliases.filter((entry) => text.includes(entry.name)).map((entry) => entry.id))
  return owners.size === 1 ? members.find((member) => member.id === [...owners][0]) : null
}

const MEMBER_FIELDS = [
  { collection: 'documents', textField: 'holder', refField: 'holderId' },
  { collection: 'usages', textField: 'borrower', refField: 'borrowerId' },
  { collection: 'policies', textField: 'insured', refField: 'insuredId' },
]

function migrateToV2(state, seed) {
  const members = structuredClone(seed.members ?? [])
  for (const { collection, textField, refField } of MEMBER_FIELDS) {
    for (const record of state[collection] ?? []) {
      if (record[refField]) continue
      const member = matchMember(record[textField], members)
      if (member) record[refField] = member.id
      // 归并不上时不写入 refField，原文本字段保持不变，展示时回退原文本
    }
  }
  state.members = members
  state.version = 2
}

export function migrateFamilyData(data, seed) {
  const next = structuredClone(data)
  if (!next.version || next.version < 2) migrateToV2(next, seed)
  return next
}
