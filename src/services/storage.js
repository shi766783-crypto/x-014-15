import { CURRENT_VERSION, migrateFamilyData } from './migration'

export function createStorage(key, seed) {
  const read = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(key))
      if (saved) return migrateFamilyData(saved, seed)
    } catch {
      // 损坏的本地数据无法解析时回退到演示数据
    }
    return { ...structuredClone(seed), version: CURRENT_VERSION }
  }
  const write = (value) => localStorage.setItem(key, JSON.stringify(value))
  return { read, write }
}
