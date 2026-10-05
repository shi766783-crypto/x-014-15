import { computed, reactive } from 'vue'
import { createStorage, matchMemberId } from '../services/storage'
import { config, seed } from '../data'

const storage = createStorage(config.storageKey, seed, config.memberLink, config.storageVersion)

export function useKeeper() {
  const state = reactive(storage.read())
  const persist = () => storage.write(state)

  // 展示名：已归属成员时显示成员正式名，否则原样显示记录上的自由文本（不丢信息）
  const displayMember = (entry, field = 'holder') =>
    state.members.find((m) => m.id === entry?.memberId)?.name || entry?.[field] || ''
  const isLinked = (entry) => Boolean(entry?.memberId && state.members.some((m) => m.id === entry.memberId))

  const add = (collection, item) => {
    const linkField = config.memberLink[collection]
    const record = { ...item }
    // 自由文本仍允许填写，保存时自动尝试归属到具体成员；归并不上保持原样
    if (linkField) record.memberId = matchMemberId(record[linkField], state.members) || undefined
    state[collection].unshift({ id: `${collection}-${Date.now()}`, createdAt: new Date().toISOString(), ...record })
    persist()
  }
  const update = (collection, id, patch) => {
    const item = state[collection].find((entry) => entry.id === id)
    if (!item) return
    const linkField = config.memberLink[collection]
    // 关联文本被改动时重新尝试归属
    if (linkField && Object.prototype.hasOwnProperty.call(patch, linkField)) {
      patch.memberId = matchMemberId(patch[linkField], state.members) || undefined
    }
    Object.assign(item, patch)
    persist()
  }
  const remove = (collection, id) => { state[collection] = state[collection].filter((entry) => entry.id !== id); persist() }
  const reset = () => { Object.assign(state, structuredClone(seed)); persist() }

  const metrics = computed(() => config.metrics.map((metric) => ({ ...metric, value: metric.value ? metric.value(state) : state[metric.collection]?.length || 0 })))

  // 家庭榜单：按真实成员统计其名下档案与使用记录
  const leaderboard = computed(() => {
    const rows = state.members.map((member) => {
      const docs = state.documents.filter((x) => x.memberId === member.id)
      const usages = state.usages.filter((x) => x.memberId === member.id)
      const returned = usages.filter((x) => x.status === '已归还').length
      const score = Math.min(99, docs.length * 12 + returned * 4 + (usages.length - returned) * 2)
      const returnRate = usages.length ? Math.round((returned / usages.length) * 100) : null
      return { id: member.id, name: member.name, docs: docs.length, usages: usages.length, returnRate, score }
    })
    return rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  })

  return { state, add, update, remove, reset, persist, metrics, leaderboard, displayMember, isLinked }
}
