import gsCfg from '../model/gsCfg.js';
import utils from '../model/mys/utils.js';
import { isV3 } from '../components/Changelog.js';
import User from '../model/user.js';
import { Cfg } from '../components/index.js';
import { pathToFileURL } from 'node:url';

export const rule = {
	userInfo: {
		reg: "^#*(ck|stoken|cookie|cookies|签到|账号)查询$",
		describe: "查看已绑定的账号"
	},
	mytoken: {
		reg: "^#*我的(stoken|sk)(\\s*\\d{6,})?$",
		describe: "查看绑定的 stoken"
	},
	delSign: {
		reg: "^#*删除(我的)*(stoken|sk)(\\s*\\d{6,})?$",
		describe: "删除已绑定的账号"
	},
	updCookie: {
		reg: "^#*(刷新|更新|获取)(ck|cookie)$",
		describe: "用已绑定的 stoken 重新换出 ck"
	},
	bindStoken: {
		reg: "^(.*)stoken=(.*)$",
		describe: "手动发送 stoken 串绑定"
	},
	bindLogin_ticket: {
		reg: "^(.*)login_ticket=(.*)$",
		describe: "手动发送 ck 时自动换出 stoken"
	},
	gclog: {
		reg: "^#*(更新|获取|导出)抽卡记录$",
		describe: "更新抽卡记录"
	}
}
const _path = process.cwd();
const YamlDataUrl = `${_path}/plugins/xiaoyao-cvs-plugin/data/yaml`;

/**
 * 列出该用户已绑定的所有账号
 */
export async function userInfo(e) {
	let data = await gsCfg.getUserStoken(e.user_id);
	let uids = Object.keys(data || {});
	if (uids.length == 0) {
		e.reply("您暂未绑定账号\n发送【#扫码登录】即可绑定~");
		return true;
	}
	let msg = `已绑定 ${uids.length} 个账号：\n`;
	uids.forEach((uid) => {
		let item = data[uid] || {};
		msg += `\n${item.region_name || ''} ${uid}`;
	});
	msg += `\n\n发送【#我的stoken】查看登录凭证`;
	msg += `\n发送【#删除stoken ${uids[0]}】删除指定账号`;
	e.reply(msg);
	return true;
}

/**
 * 输出指定账号的 stoken（不传 uid 时输出第一个）
 */
export async function mytoken(e) {
	if (!e.isPrivate) {
		e.reply("请私聊发送")
		return true;
	}
	let data = await gsCfg.getUserStoken(e.user_id);
	let uids = Object.keys(data || {});
	if (uids.length == 0) {
		e.reply("您暂未绑定账号\n发送【#扫码登录】即可绑定~");
		return true;
	}
	let want = (e.msg.match(/\d{6,}/) || [])[0];
	let uid = want && data[want] ? want : uids[0];
	let ck = data[uid] || {};
	if (!ck.stoken) {
		e.reply(`账号 ${uid} 没有可用的 stoken，请重新扫码绑定`);
		return true;
	}
	let sendMsg = `stuid=${ck.stuid};stoken=${ck.stoken};ltoken=${ck.ltoken};`;
	if (ck.mid) sendMsg += `mid=${ck.mid};`;
	e.reply(sendMsg)
	return true;
}

/**
 * 删除账号，不传 uid 时删除全部
 */
export async function delSign(e) {
	let data = await gsCfg.getUserStoken(e.user_id);
	let uids = Object.keys(data || {});
	if (uids.length == 0) {
		e.reply("您暂未绑定账号")
		return true;
	}
	let want = (e.msg.match(/\d{6,}/) || [])[0];
	if (!want && uids.length > 1) {
		e.reply(`您绑定了多个账号，请指定要删除的 uid：\n${uids.join("\n")}`);
		return true;
	}
	if (want && !data[want]) {
		e.reply(`未找到账号 ${want}，发送【#ck查询】查看已绑定的账号`);
		return true;
	}
	let delList = want ? [want] : uids;
	delList.forEach((uid) => delete data[uid]);
	gsCfg.replaceStoken(e.user_id, data);
	logger.mark(`[删除stoken] qq:${e.user_id} 删除 ${delList.join(",")}`);
	e.reply(`已删除账号：${delList.join("、")}`);
	return true;
}

// ===== 刷新 ck：用已绑定的 stoken 重新换出 ck，交给 genshin 绑定 =====

/**
 * 遍历该用户所有已绑定的 stoken，逐个换出新的 cookie_token 并交给 genshin。
 * 用于 ck 失效但 stoken 还有效的场景 —— 不用重新扫码。
 *
 * `#获取ck` / `#导出ck` 走导出分支：不绑定，只把 ck 文本发出来（需私聊）。
 */
export async function updCookie(e) {
	let stoken = await gsCfg.getUserStoken(e.user_id);
	let uids = Object.keys(stoken || {});
	if (uids.length == 0) {
		e.reply("您暂未绑定账号\n发送【#扫码登录】即可绑定~");
		return true;
	}
	let isGet = e.msg.includes("获取") || e.msg.includes("导出")
	if (!e.isPrivate && isGet) {
		e.reply("请私聊发送")
		return true;
	}
	let user = new User(e);
	let sendMsg = [];
	e._reply = e.reply;
	e.reply = (msg) => {
		sendMsg.push(msg)
	}
	let okList = [], failList = [], delList = [], warnList = [];
	for (let item of uids) {
		let ckData = stoken[item] || {};
		if (!ckData.uid || !ckData.stoken) {
			failList.push(`${item}（凭证不完整）`)
			continue;
		}
		e.uid = ckData.uid
		e.region = utils.getServer(ckData.uid)
		let cookies = `uid=${ckData.stuid}&stoken=${ckData.stoken}`
		if (ckData.mid) cookies += `&mid=${ckData.mid}`
		let data = { cookies }
		// 国际服（uid 首位 6~9）要用 post
		if (String(ckData.uid)[0] * 1 > 5) data.method = 'post'
		let res = await user.getData("bbsGetCookie", data, false)
		if (!res?.data) {
			let reason = res?.message || '请求异常'
			// stoken 已经死了，留着只会每次刷新都失败一遍，直接清掉
			if (/登录失效|登录状态失效|重新登录/.test(reason) || res?.retcode === -100) {
				delList.push(ckData.uid)
				delete stoken[item]
			} else {
				failList.push(`${ckData.uid}（${reason}）`)
			}
			continue;
		}
		e.msg = `ltoken=${ckData.ltoken};ltuid=${ckData.stuid};cookie_token=${res.data.cookie_token}; account_id=${ckData.stuid};`
		if (isGet) {
			sendMsg.push(`uid:${ckData.uid}`, e.msg)
		} else if (isV3) {
			// 分两段：import 失败才是「没装 genshin」；bing() 抛异常时凭证其实可能已经写进
			// genshin 的绑定库了（它先落库再回消息），所以不能一律报「绑定失败」误导用户
			let userck = null
			try {
				userck = (await import(pathToFileURL(`${_path}/plugins/genshin/model/user.js`).href)).default
			} catch (err) {
				logger.error(`[刷新ck] uid:${ckData.uid} 加载 genshin 失败：${err?.message}`)
				failList.push(`${ckData.uid}（未安装 genshin 插件）`)
				continue
			}
			try {
				e.ck = e.msg;
				await (new userck(e)).bing()
			} catch (err) {
				logger.error(`[刷新ck] uid:${ckData.uid} 绑定过程出错（凭证可能已写入）：${err?.message}`)
				warnList.push(`${ckData.uid}（绑定过程出错，详见日志）`)
				okList.push(ckData.uid)
				continue
			}
		} else {
			let {
				bingCookie
			} = (await import(pathToFileURL(`${_path}/lib/app/dailyNote.js`).href))
			e.isPrivate = true;
			await bingCookie(e)
		}
		okList.push(ckData.uid)
	}
	e.reply = e._reply

	// 失效凭证已清，写回 yaml（delete 过 stoken[item]）
	if (delList.length) {
		gsCfg.replaceStoken(e.user_id, stoken)
		logger.mark(`[刷新ck] qq:${e.user_id} 登录失效已删 ${delList.join(",")}`)
	}

	// 成功的绑定结果（genshin 的回复也收在这里）走合并转发，与原版一致 ——
	// 别加 isGet 条件，否则绑定分支的成功文案会被整个吞掉
	if (sendMsg.length) {
		await utils.replyMake(e, sendMsg, 0)
	}

	let lines = []
	if (okList.length) lines.push(`已刷新：${okList.join('、')}`)
	if (delList.length) lines.push(`登录已失效，凭证已删除：${delList.join('、')}`)
	if (warnList.length) lines.push(`绑定过程有异常：\n${warnList.join('\n')}`)
	if (failList.length) lines.push(`刷新失败：\n${failList.join('\n')}`)
	if (lines.length) await e._reply(lines.join('\n'))
	if (okList.length) {
		logger.mark(`[刷新ck] qq:${e.user_id} 成功 ${okList.join(",")}`)
	}
	return true;
}

// ===== 手动绑定：直接把 stoken 串 / ck 串发给机器人 =====

/**
 * 手动绑定 stoken 串（私聊），格式形如
 * `stuid=xxx;stoken=xxx;ltoken=xxx;`（`stuid=` 会自动换成 `uid=`）
 */
export async function bindStoken(e, uid = '') {
	if (!e.isPrivate) {
		e.reply("请私聊发送")
		return true;
	}
	let msg = e.msg;
	let user = new User(e);
	await user.cookie(e)
	e.uid = uid || e.uid
	e.region = utils.getServer(e.uid)
	e.cks = msg.replace(/;/g, '&').replace(/stuid/, "uid")
	e.sk = await utils.getCookieMap(msg)
	let res = await user.getData("bbsGetCookie", { cookies: e.cks }, false)
	if (!res?.data) {
		// 国际服走 post 再试一次
		e.uid = "64"
		e.region = utils.getServer(e.uid)
		res = await user.getData("bbsGetCookie", { cookies: e.cks, method: 'post' }, false)
		if (!res?.data) {
			logger.error(`[手动绑定stoken] qq:${e.user_id} 失败：${res?.message}`)
			await e.reply(`绑定失败，请检查 stoken 是否完整有效~`)
			return true;
		}
	}
	await user.seachUid(res);
	return true;
}

/**
 * 手动发 ck 串时，用其中的 login_ticket 顺手换出 stoken 存下来
 * 需要锅巴里把 `ck.sk` 打开（默认关闭，与旧版一致）
 */
export async function bindLogin_ticket(e) {
	if (!e.isPrivate) {
		e.reply("请私聊发送")
		return true;
	}
	let user = new User(e);
	let ckMap = await utils.getCookieMap((e.original_msg || e.msg).replace(/'|"/g, ""))
	let stuid = ckMap?.get("login_uid") ? ckMap?.get("login_uid") : ckMap?.get("ltuid")
	if (!stuid) stuid = ckMap?.get("account_id");
	if (ckMap && Cfg.get("ck.sk")) {
		let res = await user.getData("bbsStoken", {
			loginUid: stuid,
			loginTicket: ckMap.get("login_ticket"),
		})
		if (res?.retcode === 0) {
			e.stuid = stuid;
			await user.seachUid(res)
		}
	}
	// 放行：不拦截，让 ck 继续被别的插件（genshin）处理
	return false;
}

// ===== 抽卡记录（原神） =====
let configData = gsCfg.getfileYaml(`${_path}/plugins/xiaoyao-cvs-plugin/config/`, 'config') || {};

/**
 * 更新抽卡记录
 *
 * ⚠️ 第一行的 `user.cookie(e)` 是**必须**的：它从 genshin 的绑定库取 ck 并把 uid 写进 e.uid，
 * 下面的 getAuthKey 全靠这个 uid。去掉它就会稳定报
 * 「uid:undefined,authkey获取失败：登录状态失效，请重新绑定stoken」
 * —— 看着像凭证过期，其实是 uid 根本没取到。
 */
export async function gclog(e) {
	let user = new User(e);
	await user.cookie(e)
	let redis_Data = await redis.get(`xiaoyao:gclog:${e.user_id}`);
	if (redis_Data) {
		let time = redis_Data * 1 - Math.floor(Date.now() / 1000);
		e.reply(`请求过快,请${time}秒后重试...`);
		return true;
	}
	let isGet = /导出|获取/.test(e.msg)
	if (!e.isPrivate && isGet) {
		e.reply("请私聊发送")
		return true;
	}
	let authkey = await getAuthKey(e, user)
	if (!authkey) {
		return true;
	}
	let url = `https://public-operation-hk4e.mihoyo.com/gacha_info/api/getGachaLog?authkey_ver=1&sign_type=2&auth_appid=webview_gacha&init_type=301&gacha_id=fecafa7b6560db5f3182222395d88aaa6aaac1bc&timestamp=${Math.floor(Date.now() / 1000)}&lang=zh-cn&device_type=mobile&plat_type=ios&region=${e.region}&authkey=${encodeURIComponent(authkey)}&game_biz=hk4e_cn&gacha_type=301&page=1&size=5&end_id=0`
	e.msg = url
	let sendMsg = [];
	e.reply("抽卡记录获取中请稍等...")
	e._reply = e.reply;
	e.reply = (msg) => {
		sendMsg.push(msg)
	}
	if (isGet) {
		sendMsg = [...sendMsg, ...[1, `uid:${e.uid}`, e.msg]]
	} else {
		if (isV3) {
			let gclog = (await import(pathToFileURL(`${_path}/plugins/genshin/model/gachaLog.js`).href)).default
			await (new gclog(e)).logUrl()
		} else {
			let {
				bing
			} = (await import(pathToFileURL(`${_path}/lib/app/gachaLog.js`).href))
			e.isPrivate = true;
			await bing(e)
		}
	}
	await utils.replyMake(e, sendMsg, 1)
	let time = (configData.gclogEx || 5) * 60
	redis.set(`xiaoyao:gclog:${e.user_id}`, Math.floor(Date.now() / 1000) + time, { //数据写入缓存避免重复请求
		EX: time
	});
	return true;
}

/**
 * 清理已失效的米游社凭证
 *
 * 按**通行证**（ltuid）删：genshin 绑定库里一个通行证常挂多个角色（原神+星铁），
 * 而本插件 yaml 是按角色 uid 存的，同一个 stuid 的条目要一起清掉。
 * uid → ltuid 的换算走 genshin 绑定库；取不到时退化为「只删 uid 完全相等的那条」。
 *
 * @returns {string[]} 被删掉的 uid 列表
 */
async function purgeDeadCk(e) {
	let ltuid = gsCfg.getBingLtuid(e.user_id, e.uid)
	let data = await gsCfg.getUserStoken(e.user_id)
	let removed = []
	for (let uid of Object.keys(data || {})) {
		// ⚠️ ltuid 为空串时不能进第一个条件，否则会把所有没有 stuid 的条目误删
		let samePassport = ltuid && String(data[uid]?.stuid || '') === ltuid
		let sameUid = String(uid) === String(e.uid || '')
		if (samePassport || sameUid) {
			delete data[uid]
			removed.push(uid)
		}
	}
	if (removed.length) {
		gsCfg.replaceStoken(e.user_id, data)
	}
	return removed
}

async function getAuthKey(e, user, data = {
	auth_appid: 'webview_gacha'
}) {
	if (!e.uid) {
		e.uid = e?.runtime?.user?._regUid
	}
	if (!e.uid) {
		e.reply('未找到已绑定的米游社账号\n发送【#扫码登录】即可绑定~')
		return false
	}
	e.region = utils.getServer(e.uid)
	let authkeyrow = await user.getData("authKey", data);
	if (!authkeyrow?.data) {
		let msg = authkeyrow?.message || '请求异常'
		// 凭证已经死了：留着只会每次更新都失败一遍，直接清掉，让用户重新扫码
		if (/登录失效|登录状态失效|重新登录/.test(msg) || authkeyrow?.retcode === -100) {
			let removed = await purgeDeadCk(e)
			logger.mark(`[抽卡记录] qq:${e.user_id} uid:${e.uid} 凭证失效，已清理 ${removed.join(',') || '(yaml 无对应条目)'}`)
			e.reply(`米游社凭证已失效${removed.length ? '，已清理该账号' : ''}\n请发送【#扫码登录】重新绑定~`)
			return false;
		}
		e.reply(`uid:${e.uid},authkey获取失败：${msg}`)
		return false;
	}
	return authkeyrow.data["authkey"];
}
