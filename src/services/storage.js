// 成员匹配：优先全名精确匹配，再匹配别名。
// 匹配失败返回 null —— 调用方保留原自由文本，不丢弃信息。
export function matchMemberId(text, members = []) {
  const raw = String(text || '').trim()
  if (!raw) return null
  const named = members.find((m) => m.name === raw)
  if (named) return named.id
  const aliased = members.find((m) => (m.aliases || []).some((alias) => alias === raw))
  return aliased ? aliased.id : null
}

// 把历史自由文本归并到真实成员。
// - linkMap: { 集合名: 存放关联自由文本的字段名 }，如 { documents: 'holder' }
// - 仅在能匹配到成员时写入 memberId；
// - 原字段（holder / insured / borrower）原样保留，匹配不上也不删除、不修改；
// - 重复执行结果一致（幂等），已是最新版本的数据直接返回。
export function migrateState(raw, seed, linkMap, targetVersion) {
  const data = raw && typeof raw === 'object' ? raw : structuredClone(seed)
  const members = Array.isArray(data.members) && data.members.length ? data.members : seed.members || []

  if (!Array.isArray(data.members)) data.members = structuredClone(members)

  for (const [collection, field] of Object.entries(linkMap || {})) {
    if (!Array.isArray(data[collection])) continue
    for (const entry of data[collection]) {
      // 已归属且成员仍然存在：保持不变；指向已删除成员时重新解析
      if (entry.memberId && data.members.some((m) => m.id === entry.memberId)) continue
      const memberId = matchMemberId(entry[field], data.members)
      if (memberId) entry.memberId = memberId
      // 匹配不上时不写 memberId，原文本继续留在记录上
    }
  }

  data.version = targetVersion
  return data
}

export function createStorage(key, seed, linkMap, version = 1) {
  const read = () => {
    let stored = null
    try { stored = JSON.parse(localStorage.getItem(key)) } catch { stored = null }
    // 读取即迁移：旧版本数据归并成员后立刻回写一次
    if (stored && stored.version === version) return stored
    const next = migrateState(stored, seed, linkMap, version)
    localStorage.setItem(key, JSON.stringify(next))
    return next
  }
  const write = (value) => localStorage.setItem(key, JSON.stringify(value))
  return { read, write }
}
