const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
}
store.set('family-document-keeper-v1', JSON.stringify({
  documents: [
    { id: 'd1', name: '小满护照', holder: '小满', expires: '2030-01-01', location: 'a', copyLocation: 'b' },
    { id: 'd2', name: '予安驾照', holder: '予安', expires: '2030-01-01' },
    { id: 'd3', name: '家庭合同', holder: '林家', expires: '2030-01-01' },
  ],
  usages: [{ id: 'u1', documentId: 'd1', borrower: '小满', status: '已归还' }],
  policies: [],
}))

const { createServer } = await import('vite')
const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' })
const { useKeeper } = await vite.ssrLoadModule('/src/composables/useKeeper.js')
const { state, leaderboard, displayMember, isLinked, add } = useKeeper()
let failures = 0
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) failures++ }

check('members seeded', state.members.length === 4)
check('d1 alias migrated', state.documents[0].memberId === 'mem-1')
check('d3 raw text kept', state.documents[2].holder === '林家' && !isLinked(state.documents[2]))
check('display linked name', displayMember(state.documents[0], 'holder') === '林小满')
check('display unlinked raw', displayMember(state.documents[2], 'holder') === '林家')

const board = leaderboard.value
console.log('board:', board.map((r) => `${r.name}:${r.score}`).join(' '))
const xm = board.find((r) => r.name === '林小满')
check('xiaoman stats', xm.docs === 1 && xm.usages === 1 && xm.returnRate === 100)
const za = board.find((r) => r.name === '周予安')
check('yuanan stats', za.docs === 1 && za.returnRate === null)
check('sorted desc', board[0].score >= board[1].score)

add('documents', { name: '爸爸的病历本', holder: '老林', expires: '2031-01-01' })
check('auto-link alias on add', state.documents[0].holder === '老林' && state.documents[0].memberId === 'mem-3')
add('documents', { name: '保姆合同', holder: '张阿姨', expires: '2027-01-01' })
check('unknown text kept without memberId', state.documents[0].holder === '张阿姨' && !state.documents[0].memberId && displayMember(state.documents[0], 'holder') === '张阿姨')

await vite.close()
process.exit(failures ? 1 : 0)
