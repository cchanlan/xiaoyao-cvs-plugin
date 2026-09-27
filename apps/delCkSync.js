/**
 * #删除ck 同步钩子
 *
 * genshin 的 #删除ck 只删 Yunzai 绑定库里的 ck，不会清理本插件 data/yaml 里的 stoken，
 * 导致「已经删掉的账号」还留在 yaml 里。本钩子补上这一步。
 *
 * 做法（不改 genshin 一行）：
 *  1. 注册同一条 #删除ck 正则，priority 低于 genshin(300) → 本钩子先执行；
 *  2. 先按 genshin 自己的判据取出「这次要删的 ltuid」（当前 uid 对应的 ck 账号）；
 *  3. return false 放行，让 genshin 正常删除；
 *  4. 短间隔轮询 MysUserDB，确认该 ltuid 的记录真没了，才去 yaml 里清掉 stuid 等于它的条目。
 *
 * 为什么不是删完直接清：绑定失败（比如当前 uid 没有 ck）时 genshin 不会删任何东西，
 * 那时清 yaml 就是误删。必须等它真删成功。
 *
 * 无 genshin 的环境：没人能发出 #删除ck（该指令由 genshin 注册），本钩子永不触发，零副作用。
 */

import plugin from '../../../lib/plugins/plugin.js'
import gsCfg from '../model/gsCfg.js'

const _path = process.cwd()
const POLL_INTERVAL_MS = 500
const POLL_MAX_MS = 8000

/** 动态导入 genshin 的模块，取不到就返回 null（没装 genshin 时正常降级） */
async function loadGenshin(relPath) {
	try {
		let mod = await import(`file://${_path}/plugins/genshin/${relPath}`)
		return mod?.default || null
	} catch (err) {
		return null
	}
}

export class DelCkSync extends plugin {
	constructor() {
		super({
			name: '[xiaoyao]删除ck同步',
			dsc: 'genshin #删除ck 后，把本插件 yaml 里对应的 stoken 一起清掉',
			event: 'message',
			// 必须小于 genshin 用户绑定插件的 priority(300)，确保本钩子先跑、先取到 ltuid
			priority: 290,
			rule: [
				{
					reg: /^#?(原神|星铁|绝区零)?删除c(oo)?k(ie)?$/i,
					fnc: 'onDelCk',
				},
			],
		})
	}

	async onDelCk(e) {
		const qq = e.user_id
		try {
			const data = await gsCfg.getUserStoken(qq)
			const uids = Object.keys(data || {})
			// 没绑过 stoken，没什么可清的
			if (!uids.length) return false

			// 按 genshin 的判据取本次要删的 ltuid
			const NoteUser = await loadGenshin('model/mys/NoteUser.js')
			if (!NoteUser) return false
			const user = await NoteUser.create(e)
			// e.game 在 #删除ck 这条路上恒为 undefined，与 genshin 一致地回落到 gs
			const uidData = user.getUidData('', e.game || 'gs')
			if (!uidData || uidData.type !== 'ck' || !uidData.ltuid) {
				// genshin 这次删不掉（会回「无CK信息」），别动 yaml
				return false
			}
			this._pollRemoved(e, qq, String(uidData.ltuid), uids)
		} catch (err) {
			logger.debug(`[xiaoyao][删除ck同步] 取 ltuid 失败: ${err?.message}`)
		}
		// 关键：放行，让 genshin 继续执行真正的删除逻辑
		return false
	}

	/**
	 * 轮询 MysUserDB，确认 ltuid 记录已消失后清理 yaml；最长等到 POLL_MAX_MS 超时。
	 * 相比固定单次延时，能容忍 genshin 落盘慢于预期而不漏清。
	 */
	_pollRemoved(e, qq, ltuid, uids) {
		const startAt = Date.now()
		const tick = async () => {
			try {
				const MysUserDB = await loadGenshin('model/db/MysUserDB.js')
				if (!MysUserDB) return
				const still = await MysUserDB.find(ltuid)
				if (!still) {
					await this._clean(e, qq, ltuid, uids)
					return
				}
			} catch (err) {
				logger.debug(`[xiaoyao][删除ck同步] 对账失败: ${err?.message}`)
				return
			}
			if (Date.now() - startAt < POLL_MAX_MS) {
				setTimeout(tick, POLL_INTERVAL_MS)
			}
		}
		setTimeout(tick, POLL_INTERVAL_MS)
	}

	/** 清掉 yaml 里所有 stuid 等于该 ltuid 的条目（一个通行证可能挂着原神/星铁多个角色） */
	async _clean(e, qq, ltuid, uids) {
		const data = await gsCfg.getUserStoken(qq)
		const removed = []
		for (const uid of uids) {
			if (String(data?.[uid]?.stuid || '') === ltuid) {
				delete data[uid]
				removed.push(uid)
			}
		}
		if (!removed.length) return
		gsCfg.replaceStoken(qq, data)
		logger.mark(`[xiaoyao][删除ck同步] qq:${qq} ltuid:${ltuid} 已清理 uid: ${removed.join(',')}`)
		await e.reply(`米游社凭证已一并删除：${removed.join('、')}`)
	}
}
