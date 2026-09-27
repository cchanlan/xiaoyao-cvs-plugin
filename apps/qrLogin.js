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
const _path = process.cwd();

export const rule = {
	qrCodeLogin: {
		reg: `^#(扫码|二维码|辅助)(登录|绑定|登陆)$`,
		describe: "扫码登录"
	},
}

/**
 * 扫码登录：出二维码 → 轮询扫码状态 → 拿到 stoken/ck → 落盘
 */
export async function qrCodeLogin(e, { render }) {
	let power = Cfg.get("mhy.qrcode")
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
	e._reply = e.reply
	let sendMsg = [segment.at(e.user_id), '\n请扫码以完成绑定\n']
	e.reply = (msg) => {
		sendMsg.push(msg)
	}
	await Common.render(`qrCode/index`, {
		url: res.data.url
	}, {
		e,
		render,
		scale: 1.2, retMsgId: true
	})
	let r = await e._reply(sendMsg)
	utils.recallMsg(e, r, 30) //默认30秒后撤回二维码，有需要请自行修改
	e.reply = e._reply
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
