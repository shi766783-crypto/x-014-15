import assert from 'node:assert/strict'
import { migrateFamilyData, matchMember, CURRENT_VERSION } from '../src/services/migration.js'
import { seed } from '../src/data.js'

// 旧版本地数据（v1，没有 members / 版本号），称呼写法各不相同
const legacy = {
  documents: [
    { id: 'd1', name: '身份证', holder: '林小满' },
    { id: 'd2', name: '保险', holder: '林家' },              // 家庭共用，不归并
    { id: 'd3', name: '驾驶证', holder: '小满' },            // 别名
    { id: 'd4', name: '护照', holder: '周予安' },
    { id: 'd5', name: '教师证', holder: '予安' },            // 别名
    { id: 'd6', name: '公证', holder: '林小满（本人）' },     // 姓名带括注
    { id: 'd7', name: '体检报告', holder: '外婆' },           // 未知文本，不归并不丢失
    { id: 'd8', name: '合影', holder: '林小满和周予安' },      // 两位成员同时出现，不归并
  ],
  usages: [
    { id: 'u1', borrower: '周予安（本人）' },
    { id: 'u2', borrower: '小满' },
  ],
  policies: [
    { id: 'p1', insured: '全家' },
    { id: 'p2', insured: '予安' },
  ],
}

const out = migrateFamilyData(legacy, seed)

assert.equal(out.version, CURRENT_VERSION)
assert.equal(out.members.length, 2)

const byId = Object.fromEntries(out.documents.map((d) => [d.id, d]))
assert.equal(byId.d1.holderId, 'member-lin')
assert.equal(byId.d1.holder, '林小满', '原文本必须保留')
assert.equal('holderId' in byId.d2, false, '家庭共用文本不应归并')
assert.equal(byId.d2.holder, '林家')
assert.equal(byId.d3.holderId, 'member-lin')
assert.equal(byId.d4.holderId, 'member-zhou')
assert.equal(byId.d5.holderId, 'member-zhou')
assert.equal(byId.d6.holderId, 'member-lin')
assert.equal('holderId' in byId.d7, false, '未知称呼不应归并')
assert.equal(byId.d7.holder, '外婆', '未归并原文本不能丢失')
assert.equal('holderId' in byId.d8, false, '同时出现多人不应强行归并')
assert.equal(byId.d8.holder, '林小满和周予安')

const [u1, u2] = out.usages
assert.equal(u1.borrowerId, 'member-zhou')
assert.equal(u1.borrower, '周予安（本人）')
assert.equal(u2.borrowerId, 'member-lin')

assert.equal('insuredId' in out.policies[0], false)
assert.equal(out.policies[0].insured, '全家')
assert.equal(out.policies[1].insuredId, 'member-zhou')

// 幂等：对迁移结果再跑一次不得改变引用
const again = migrateFamilyData(out, seed)
assert.deepEqual(again, out)

// 已经是新版本的数据不应再改动
const v2 = { version: 2, members: [], documents: [{ id: 'x', holder: '随便什么' }] }
assert.deepEqual(migrateFamilyData(v2, seed).documents, v2.documents)

// matchMember 直接单测
assert.equal(matchMember('  林 小满 ', seed.members)?.id, 'member-lin')
assert.equal(matchMember('林', seed.members), null, '单字“林”不应误匹配')
assert.equal(matchMember('', seed.members), null)

console.log('migration tests passed ✔')
