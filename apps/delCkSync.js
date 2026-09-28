/**
 * #删除ck 同步钩子
 *
 * genshin 的 #删除ck 只删它自己的一部分数据，不会清理本插件 data/yaml 里的 stoken，
 * 也不会把 genshin 自己的残留清干净（详见下面 purgeGenshinUser 的注释）。
 * 本钩子补上这两件事。
 *
 * 做法（不改 genshin 一行）：
 *  1. 注册同一条 #删除ck 正则，priority 290 低于 genshin(300) → 本钩子先执行；
 *  2. 劫持本次事件的 `e.reply`（genshin 的 `this.reply()` 最终就是调它），
 *     原样透传，但从它发出的「绑定Cookie已删除」那段文案里读出被删的 uid；
 *  3. 读到 uid 后等 XHH_GRACE_MS 再清理（给 xhh-TL 留读指纹的时间）。
 *
 * ⚠️ 为什么是「读它的回复」而不是别的：
 *  - 自己复刻 genshin 的判据去猜要删哪个通行证 → **实测会猜错**
 *    （主人 `#删除ck` 时 genshin 删的是 A，钩子算出 B：该删的没删、不该删的被删了）；
 *  - 观察 `data/MysCookie/<QQ>.yaml` 的变化 → 也**不行**，那个文件不是 genshin 的实时
 *    数据源（实测用户删除后该文件纹丝不动），真正的库在 SQLite。
 *  genshin 自己发出来的那句「绑定Cookie已删除 + 每个游戏被删的 uid」才是唯一权威，
 *  直接读它，不要去猜、也不要去追它的存储实现。
 *
 * ⚠️ 为什么要等 XHH_GRACE_MS 才清：xhh-TL 的 delCkHook 也在监听同一个 #删除ck，
 * 它会从本插件 yaml 里读走被删账号的 stoken 作为「指纹」记进自己的已删名单，
 * 日后用户重新扫码时靠指纹变化自愈。如果本插件先把 yaml 条目删了，它只会记到空指纹，
 * 自愈就永久失效（重新扫码了体力还是查不出来）。它最多轮询 8s，所以延后 9s 再清。
 *
 * 无 genshin 的环境：没人能发出 #删除ck（该指令由 genshin 注册），本钩子永不触发，零副作用。
 */

import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import YAML from 'yaml'
import gsCfg from '../model/gsCfg.js'
import { pathToFileURL } from 'node:url'

const _path = process.cwd()

/**
 * 清 yaml 前的等待时间。必须大于 xhh-TL delCkHook 的轮询上限（8s），
 * 保证它先读到 stoken 记下指纹。改这里前先确认对方的 POLL_MAX_MS。
 */
const XHH_GRACE_MS = 9000

/** 动态 import genshin 的模块，取不到（没装 / 路径变了）返回 null */
async function loadGenshin(relPath) {
	try {
		let mod = await import(pathToFileURL(`${_path}/plugins/genshin/${relPath}`).href)
		return mod?.default || null
	} catch (err) {
		return null
	}
}

/**
 * 补删 genshin 侧的残留 —— 四处都要动，缺一处账号就会「删了又活」：
 *
 * ⚠️ 这是 genshin 的缺口（2026-09-28 主人实测：删了 ck，体力插件照样查得到）：
 *  1. `Users.ltuids` —— 它的 `#删除ck` **完全不管**这个字段
 *  2. `Users.games` —— **体力插件就是从这个字段读 uid 的**
 *     （xhh-TL `utils/userBind.js`：`games[g].uid` 与 `games[g].data` 都会被注册成可查 UID）。
 *     它跟 ltuids 是**两个独立字段**，只清一个另一个还会把账号顶出来。
 *  3. `MysUsers` 行 —— 它的 `del()` 有时没删干净
 *  4. `data/MysCookie/<QQ>.yaml` + `temp/MysCookieBak/<QQ>.yaml` —— **重启复活的关键**：
 *     genshin 的 `init()` 每次都跑 `loadOldDataV3()`，把 `data/MysCookie` 下的 yaml
 *     **回灌进 SQLite**（`loadOldData()`），回灌完把源文件**移到** `temp/MysCookieBak/`。
 *     所以两个位置都要清，否则下一次回灌/重启又活过来。
 *
 * ⚠️ 只按「被删的 uid」清，**不要**按通行证去反推 uid 列表 ——
 * 早先的实现把 `MysUsers.uids` 里的 uid 全当死账号，结果误删了同一 QQ 下**另一个有效通行证**的账号。
 * genshin 回复里点名的 uid 才是唯一依据。
 *
 * @param {string} qq QQ 号
 * @param {Set<string>} deadUids genshin 回复里点名的、本次被删的 uid
 * @param {Set<string>} deadLtuids 这些 uid 对应的通行证（用于清 ltuids / MysCookie）
 */
async function purgeGenshinUser(qq, deadUids, deadLtuids) {
	let fixed = false

	// ① Users 表：ltuids 与 games 是两个独立字段，都要清
	try {
		let UserDB = await loadGenshin('model/db/UserDB.js')
		let db = UserDB && (await UserDB.find(qq, 'qq'))
		if (db) {
			let changed = false

			let before = String(db.ltuids || '')
			let after = before.split(',')
				.map(s => s.trim())
				.filter(ltuid => ltuid && !deadLtuids.has(ltuid))
				.join(',')
			if (after !== before) {
				db.ltuids = after
				changed = true
				logger.mark(`[xiaoyao][删除ck同步] 已清理 Users.ltuids: ${before} → ${after || '(空)'}`)
			}

			// ⚠️ games 是 sequelize 的 JSON 列，取出来可能已经是对象（不是字符串），
			// 直接 JSON.parse 会抛「Unexpected token o」，于是整个 games 分支被跳过
			let games = db.games
			if (typeof games === 'string') {
				try {
					games = JSON.parse(games)
				} catch (err) {
					games = {}
				}
			}
			if (!games || typeof games !== 'object') games = {}
			let gamesChanged = false
			for (const g of Object.keys(games)) {
				const ds = games[g] || {}
				if (ds.uid && deadUids.has(String(ds.uid))) {
					delete ds.uid
					gamesChanged = true
				}
				if (ds.data) {
					for (const uid of Object.keys(ds.data)) {
						if (deadUids.has(String(uid))) {
							delete ds.data[uid]
							gamesChanged = true
						}
					}
				}
			}
			if (gamesChanged) {
				db.games = games
				changed = true
				logger.mark(`[xiaoyao][删除ck同步] 已清理 Users.games 里的 ${[...deadUids].join(',')}`)
			}

			if (changed) {
				await db.save()
				fixed = true
			}
		}
	} catch (err) {
		logger.debug(`[xiaoyao][删除ck同步] 清理 genshin Users 表失败: ${err?.message}`)
	}

	// ② MysUsers 行
	try {
		let MysUserDB = await loadGenshin('model/db/MysUserDB.js')
		if (MysUserDB) {
			for (const ltuid of deadLtuids) {
				let row = await MysUserDB.find(ltuid)
				if (row) {
					await row.destroy()
					logger.mark(`[xiaoyao][删除ck同步] 已清理 MysUsers 残留: ${ltuid}`)
					fixed = true
				}
			}
		}
	} catch (err) {
		logger.debug(`[xiaoyao][删除ck同步] 清理 genshin MysUsers 表失败: ${err?.message}`)
	}

	// ③ MysCookie 的两个位置（源目录 + 回灌后的备份目录），不清重启会复活
	for (const rel of [`data/MysCookie/${qq}.yaml`, `temp/MysCookieBak/${qq}.yaml`]) {
		try {
			let file = `${_path}/${rel}`
			if (!fs.existsSync(file)) continue
			let raw = YAML.parse(fs.readFileSync(file, 'utf-8')) || {}
			let changed = false
			for (let uid of Object.keys(raw)) {
				if (deadLtuids.has(String(raw[uid]?.ltuid || '')) || deadUids.has(String(uid))) {
					delete raw[uid]
					changed = true
				}
			}
			if (!changed) continue
			if (Object.keys(raw).length) {
				fs.writeFileSync(file, YAML.stringify(raw), 'utf8')
			} else {
				fs.unlinkSync(file)
			}
			logger.mark(`[xiaoyao][删除ck同步] 已清理 ${rel} 残留`)
			fixed = true
		} catch (err) {
			logger.debug(`[xiaoyao][删除ck同步] 清理 ${rel} 失败: ${err?.message}`)
		}
	}

	return fixed
}

export class DelCkSync extends plugin {
	constructor() {
		super({
			name: '[xiaoyao]删除ck同步',
			dsc: 'genshin #删除ck 后，把本插件 yaml 与 genshin 的残留一起清掉',
			event: 'message',
			// 必须小于 genshin 用户绑定插件的 priority(300)，确保本钩子先跑、先挂上劫持
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
			// 本插件没绑过 stoken，没什么可清的
			if (!Object.keys(data || {}).length) return false

			const self = this
			const originReply = e.reply
			e.reply = function (...args) {
				try {
					const uids = self._parseDeletedUids(self._toText(args[0]))
					if (uids.length) {
						logger.mark(`[xiaoyao][删除ck同步] 读到 genshin 删除结果: ${uids.join(',')}`)
						// 清理由原生 reply 发出，避免再进本函数
						setTimeout(() => self._clean(e, originReply, qq, uids), XHH_GRACE_MS)
					}
				} catch (err) {
					logger.debug(`[xiaoyao][删除ck同步] 解析回复失败: ${err?.message}`)
				}
				// 原样透传，不影响 genshin 正常发消息
				return originReply.apply(this, args)
			}
		} catch (err) {
			logger.debug(`[xiaoyao][删除ck同步] 挂载失败: ${err?.message}`)
		}
		// 放行，让 genshin 继续执行真正的删除逻辑
		return false
	}

	/** 把回复内容转成纯文本（可能是字符串 / 数组 / segment 对象） */
	_toText(msg) {
		if (!msg) return ''
		if (typeof msg === 'string') return msg
		if (Array.isArray(msg)) return msg.map(m => this._toText(m)).join('\n')
		if (typeof msg === 'object') {
			if (typeof msg.text === 'string') return msg.text
			if (typeof msg.message === 'string') return msg.message
			if (Array.isArray(msg.message)) return this._toText(msg.message)
			if (msg.data) return this._toText(msg.data)
		}
		return ''
	}

	/**
	 * 从 genshin 的删除结果里解析被删的 uid
	 * 文案形如：
	 *   绑定Cookie已删除
	 *   【原神】:168927589
	 *   【星穹铁道】:109836190
	 */
	_parseDeletedUids(text) {
		if (!text || !/Cookie已删除/.test(text)) return []
		const uids = []
		const re = /[:：]\s*(\d{8,})/g
		let m
		while ((m = re.exec(text))) uids.push(m[1])
		return [...new Set(uids)]
	}

	/**
	 * 清理被删账号
	 *
	 * 两件事都要做，且**互不依赖**：
	 *  - 清本插件 yaml 里对应的条目（可能本来就没了，那就什么都不用清）
	 *  - 补删 genshin 侧的残留（它自己的 #删除ck 不做这步，账号会「删了又活」）
	 *
	 * ⚠️ 不能因为「yaml 没清到东西」就整体 return —— 那样 genshin 的残留永远补不掉。
	 */
	async _clean(e, reply, qq, uids) {
		const deadUids = new Set(uids.map(String))

		// 用被删 uid 反查通行证（只认 genshin 回复里点名的那些 uid，不反推整个通行证）
		const deadLtuids = new Set()
		for (const uid of deadUids) {
			const lt = gsCfg.getBingLtuid(qq, uid)
			if (lt) deadLtuids.add(String(lt))
		}

		// ① 清本插件 yaml：按通行证删（同一通行证的其它角色也一起失效）
		const data = await gsCfg.getUserStoken(qq)
		const removed = []
		for (const uid of Object.keys(data || {})) {
			const stuid = String(data[uid]?.stuid || '')
			if (deadUids.has(String(uid)) || (stuid && deadLtuids.has(stuid))) {
				delete data[uid]
				removed.push(uid)
			}
		}
		if (removed.length) gsCfg.replaceStoken(qq, data)

		// ② 补删 genshin 侧残留（与 yaml 是否清到东西无关）
		const fixed = await purgeGenshinUser(qq, deadUids, deadLtuids)

		if (removed.length) {
			logger.mark(`[xiaoyao][删除ck同步] qq:${qq} 已清理 yaml uid: ${removed.join(',')}`)
			await reply.call(e, `米游社凭证已一并删除：${removed.join('、')}`)
		} else if (fixed) {
			logger.mark(`[xiaoyao][删除ck同步] qq:${qq} yaml 无对应条目，已补删 genshin 残留`)
		}
	}
}
