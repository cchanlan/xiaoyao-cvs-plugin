import {
	isV3
} from '../components/Changelog.js'
import mys from "../model/qrLogin.js"
import Common from "../components/Common.js";
import utils from '../model/mys/utils.js';
import User from '../model/user.js';
import {
	Cfg,
} from "../components/index.js";
import { pathToFileURL } from 'node:url'
import { createQrRenderData } from '../model/qrTheme.js'
const _path = process.cwd();

export const rule = {
	qrCodeLogin: {
		reg: `^#(扫码|二维码|辅助)(登录|绑定|登陆)$`,
		describe: "扫码登录"
	},
}

/**
 * 扫码登录：出二维码 → 轮询扫码状态 → 拿到 stoken/ck → 落盘 + 交给 genshin 绑定
 */
export async function qrCodeLogin(e, { render }) {
	let power = Cfg.get("mhy.qrcode", 0)
	if (power === 3) {
		return false;
	} else {
		if (power == 2 && !e.isPrivate) {
			return false;
		}
		if (power == 1 && !e.isGroup) {
			return false;
		}
	}
	let Mys = new mys(e)
	let res = await Mys.qrCodeLogin()
	if (!res?.data) return false;
	const originalReply = e.reply
	e._reply = originalReply
	// 群聊才 at；图片生成期间临时收集回复，完成或失败都恢复原 reply。
	let sendMsg = e.isGroup ? [segment.at(e.user_id), '\n请扫码以完成绑定\n'] : ['请扫码以完成绑定\n']
	const prefixLength = sendMsg.length
	e.reply = (msg) => { sendMsg.push(msg) }
	try {
		await Common.render('qrCode/index', createQrRenderData(res.data.url), {
			e, render, scale: 1.2, retMsgId: true
		})
		if (sendMsg.length === prefixLength) throw new Error('二维码渲染无结果')
		let r = await originalReply.call(e, sendMsg)
		utils.recallMsg(e, r, 30) // 默认30秒后撤回二维码
	} catch {
		// 不记录渲染数据或异常正文，避免登录二维码中的票据进入日志。
		logger.error('[扫码登录] 二维码图片生成或发送失败')
		await originalReply.call(e, '二维码图片生成失败，请稍后重试~', true)
		return true
	} finally {
		e.reply = originalReply
	}
	res = await Mys.GetQrCode(res.data.ticket)
	if (!res) return true;
	await bindSkCK(e, res)
	return true;
}

/**
 * 扫码成功后把 sk 存进插件自己的 yaml、把 ck 交给 genshin 插件
 */
export async function bindSkCK(e, res) {
	e.msg = res?.stoken, e.raw_message = res?.stoken
	e.isPrivate = true
	await saveStoken(e, '1')
	e.ck = res?.cookie, e.msg = res.cookie, e.raw_message = res.cookie;
	if (isV3) {
		// Windows 上手拼 file:// 不是合法 URL，必须走 pathToFileURL
		let genshinUser = `${_path}/plugins/genshin/model/user.js`
		let userck = (await import(pathToFileURL(genshinUser).href)).default
		await (new userck(e)).bing()
	} else {
		let {
			bingCookie
		} = (await import(pathToFileURL(`${_path}/lib/app/dailyNote.js`).href))
		await bingCookie(e)
	}
}

/**
 * 用一段 stoken 串换出 cookie_token 并记录该账号下的所有 uid
 * @param {*} e
 * @param {string} uid 传 '1' 表示先用默认区服探测，失败再按海外服重试
 */
export async function saveStoken(e, uid = '') {
	let msg = e.msg;
	let user = new User(e);
	e.uid = uid || e.uid
	e.region = utils.getServer(e.uid)
	e.cks = msg.replace(/;/g, '&').replace(/stuid/, "uid")
	e.sk = await utils.getCookieMap(msg)
	let res = await user.getData("bbsGetCookie", { cookies: e.cks }, false)
	if (!res?.data) {
		e.uid = "64"
		e.region = utils.getServer(e.uid)
		res = await user.getData("bbsGetCookie", { cookies: e.cks, method: 'post' }, false)
		if (!res?.data) {
			logger.error(`[扫码登录] stoken 换 ck 失败：${res?.message}`)
			await e.reply(`绑定失败，请重新扫码~`)
			return true;
		}
	}
	await user.seachUid(res);
	return true;
}
