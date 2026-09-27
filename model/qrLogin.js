import User from "./user.js";
import utils from './mys/utils.js';

/**
 * 米游社扫码登录
 * 流程：createQRLogin 拿二维码 url+ticket → 轮询 queryQRLoginStatus → 拿 stoken 换 ck
 */
export default class mysQrLogin {
	constructor(e) {
		this.e = e;
		this.user = new User(e);
		this.sendMsgUser = `免责声明:您将通过扫码完成获取米游社sk以及ck。\n本Bot将不会保存您的登录状态。\n我方仅提供米游社查询及相关游戏内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码~`
	}

	async qrCodeLogin() {
		let RedisData = await utils.redisGet(this.e.user_id, "GetQrCode")
		if (RedisData) {
			this.e.reply([segment.at(this.e.user_id), `前置二维码未扫描，请勿重复触发指令`])
			return false;
		}
		this.device = await utils.randomString(16)
		this.e.reply(this.sendMsgUser)
		let res = await this.user.getData("qrCodeLogin", {
			device: this.device
		}, false)
		if (!res?.data) {
			logger.error(`[扫码登录] 获取二维码失败`)
			return false;
		}
		res.data["ticket"] = res.data["ticket"] || res?.data?.url.split("ticket=")[1]
		return res
	}

	async GetQrCode(ticket) {
		await utils.redisSet(this.e.user_id, "GetQrCode", { GetQrCode: 1 }, 60 * 5) //设置5分钟缓存避免重复触发
		let res;
		let RedisData = await utils.redisGet(this.e.user_id, "GetQrCode")
		for (let n = 1; n < 60; n++) {
			await utils.sleepAsync(5000)
			res = await this.user.getData("qrCodeQuery", {
				device: this.device, ticket
			}, false)
			if (res?.data?.status == "Scanned" && RedisData.GetQrCode == 1) {
				logger.mark(JSON.stringify(res))
				await this.e.reply("二维码已扫描，请确认登录", true)
				RedisData.GetQrCode++;
			}
			if (res?.data?.status == "Confirmed") {
				logger.mark(JSON.stringify(res))
				break
			}
		}
		await utils.redisDel(this.e.user_id, 'GetQrCode')
		if (!res?.data?.tokens && !res?.data?.user_info) {
			await this.e.reply("验证超时", true)
			return false
		}
		const uid = res.data.user_info.aid || res.data.user_info.uid || res.data.user_info.account_id
		const mid = res.data.user_info.mid
		let token = (res.data.tokens.find(i => i.name === "stoken" || i.name === "stoken_v2") || res.data.tokens[0])?.token
		if (!(uid && token && mid)) {
			await this.e.reply("stoken获取不完整请重新扫码", true);
			return false
		}
		let UserData = await this.user.getData("bbsGetCookie", { cookies: `stoken=${token}&uid=${uid}&mid=${mid}` }, false)
		let stoken = `stoken=${token};stuid=${uid};mid=${mid}`
		return {
			cookie: `ltoken=${token};ltuid=${uid};cookie_token=${UserData.data?.cookie_token}`,
			stoken
		}
	}
}
