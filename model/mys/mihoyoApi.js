import utils from './utils.js';
import md5 from 'md5';
import _ from 'lodash';
import fs from "fs";
import YAML from 'yaml'
import {
	Data
} from "../../components/index.js";
import gsCfg from '../gsCfg.js'
import {
	isV3
} from '../../components/Changelog.js';
import fetch from "node-fetch"
import mys from "./mysTool.js";
const _path = process.cwd();
const DEVICE_ID = utils.randomString(32).toUpperCase();
const DEVICE_NAME = utils.randomString(_.random(1, 10));
const yamlDataUrl = `${_path}/plugins/xiaoyao-cvs-plugin/data/yaml`;
let HttpsProxyAgent = ''

/**
 * 米游社接口请求
 * 只保留扫码登录链路用到的接口：账号角色查询、stoken 换 ck、二维码创建/轮询
 */
export default class miHoYoApi {
	constructor(e) {
		if (e) {
			this.e = e
			this.cookie = e.cookie
			this.userId = String(e.user_id)
			this.isOs = false;
			if (this.e?.uid) {
				this.isOs = this.e?.uid[0] * 1 > 5
			}
			this.apiMap = {
				apiWeb: mys.web_api,
				saltweb: mys.saltWeb,
				saltSign: mys.salt
			}
			if (this.isOs) {
				this.apiMap = {
					apiWeb: mys.os_web_api,
					saltweb: mys.saltWeb,
					saltSign: mys.salt
				}
			}
			let data = this.getStoken(this.e.user_id);
			if (data) {
				this.cookies = `stuid=${data.stuid};stoken=${data.stoken};ltoken=${data.ltoken};`;
				if (data?.mid) {
					this.cookies = `stuid=${data.stuid};stoken=${data.stoken};mid=${data.mid};`;
				}
				this.e.cookies = this.cookies
			}
		}
		Data.createDir("", yamlDataUrl, false);
	}

	getBody(name) {
		for (let item in mys.boards) {
			if (mys.boards[item].name === name) {
				return mys.boards[item]
			}
		}
	}

	async getData(type, data = {}) {
		let gameBody = this.getBody(data.name);
		let {
			url,
			headers,
			body
		} = this.getUrl(type, gameBody, data)

		if (!url) return false
		if (data.headers) {
			headers = {
				...headers,
				...data.headers
			}
			delete data.headers
		}
		let param = {
			headers,
			agent: await this.getAgent(),
			timeout: 10000
		}

		if (body) {
			param.method = 'post'
			param.body = body
		} else {
			param.method = 'get'
		}
		//用于处理特殊情况
		if (data.method) {
			param.method = data.method
		}
		let response = {}
		try {
			response = await fetch(url, param)
		} catch (error) {
			logger.error(error.toString())
			return false
		}
		if (!response.ok) {
			Bot.logger.error(`[接口][${type}][${this.e.uid}] ${response.status} ${response.statusText}`)
			return false
		}

		let res = await response.text();
		if (res.startsWith('(')) {
			res = JSON.parse((res).replace(/\(|\)/g, ""))
		} else {
			res = JSON.parse(res)
		}
		if (!res) {
			Bot.logger.mark('mys接口没有返回')
			return false
		}
		if (res.retcode !== 0) {
			Bot.logger.debug(`[米游社接口][请求参数] ${url} ${JSON.stringify(param)}`)
		}
		res.api = type
		return res
	}

	getUrl(type, board, data) {
		let urlMap = {
			userGameInfo: { //通用查询
				url: `${this.apiMap.apiWeb}/binding/api/getUserGameRolesByCookie`,
				query: `game_biz=${this.isOs ? board?.osbiz : board?.biz}`,
				types: 'sign'
			},
			getLtoken: {
				url: `${mys.pass_api}/account/auth/api/getLTokenBySToken`,
				query: `${data?.cookies?.replace(/;/g, '&')}`,
			},
			bbsGetCookie: {
				url: `${this.apiMap.apiWeb}/auth/api/getCookieAccountInfoBySToken`,
				query: `game_biz=hk4e_cn&${data.cookies}`,
				types: ''
			},
			qrCodeLogin: {
				url: `${mys.pass_api}/account/ma-cn-passport/app/createQRLogin`,
				body: {},
				types: 'pass'
			},
			qrCodeQuery: {
				url: `${mys.pass_api}/account/ma-cn-passport/app/queryQRLoginStatus`,
				body: {
					ticket: data.ticket
				},
				types: 'pass'
			}
		}
		if (!urlMap[type]) return false
		let {
			url,
			query = '',
			body = '',
			types = '',
			sign = ''
		} = urlMap[type]
		if (query) url += `?${query}`
		if (body) body = JSON.stringify(body)
		let headers = this.getHeaders(board, types, sign, body, query)
		return {
			url,
			headers,
			body
		}
	}

	getHeaders(board, type = "bbs", sign, body = {}, query = '') {
		let header = {};
		switch (type) {
			case "sign":
				header = {
					'accept-language': 'zh-CN,zh;q=0.9,ja-JP;q=0.8,ja;q=0.7,en-US;q=0.6,en;q=0.5',
					'x-rpc-device_id': DEVICE_ID,
					'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/${mys.APP_VERSION}`,
					Referer: board?.getReferer(),
					Host: 'api-takumi.mihoyo.com',
					'x-rpc-channel': 'appstore',
					'x-rpc-app_version': mys.APP_VERSION,
					'x-requested-with': 'com.mihoyo.hyperion',
					'x-rpc-client_type': '5',
					'Content-Type': 'application/json;charset=UTF-8',
					DS: this.getDs(),
					'Cookie': this.cookie
				}
				if (board?.key === "genshin") {
					header["x-rpc-signgame"] = "hk4e"
				}
				if (this.isOs) {
					header = {
						app_version: '2.9.0',
						User_Agent: `Mozilla/5.0 (Linux; Android 9.0; SAMSUNG SM-F900U Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBSOversea/2.9.0`,
						client_type: '2',
						'x-rpc-app_version': '2.9.0',
						Origin: 'https://webstatic-sea.hoyolab.com',
						X_Requested_With: 'com.mihoyo.hoyolab',
						Referer: 'https://webstatic-sea.hoyolab.com',
						DS: this.getDs(),
						'Cookie': this.cookie
					}
				}
				break;
			case "pass":
				header = {
					'x-rpc-device_id': DEVICE_ID,
					'x-rpc-app_id': "bll8iq97cem8",
					'x-rpc-device_name': DEVICE_NAME,
					"x-rpc-device_fp": "38d7ee0e96649",
					"x-rpc-device_model": utils.randomString(16),
					'x-rpc-app_version': mys.APP_VERSION,
					'x-rpc-game_biz': 'bbs_cn',
					"x-rpc-sys_version": "11",
					"x-rpc-aigis": '',
					"Content-Type": "application/json;",
					"x-rpc-client_type": "2",
					"DS": this.getDs2('', body, mys.passSalt),
					"x-rpc-sdk_version": '1.3.1.2',
					"User-Agent": "okhttp/4.8.0",
					"Connection": 'Keep-Alive',
					"Accept-Encoding": "gzip, deflate, br",
					"x-rpc-channel": "appstore",
					Cookie: this.cookies,
				}
				break;
			default:
				header = {}
				break;
		}
		return header;
	}

	getStoken(userId) {
		let file = `${yamlDataUrl}/${userId}.yaml`
		try {
			let ck = fs.readFileSync(file, 'utf-8')
			ck = YAML.parse(ck)
			if (ck?.uid) {
				let datalist = {};
				ck.userId = this.e.user_id
				datalist[ck.uid] = ck;
				ck = datalist
				gsCfg.saveBingStoken(this.e.user_id, datalist)
			}
			return ck[this.e.uid] || {}
		} catch (error) {
			return {}
		}
	}

	//社区相关接口的 ds 签名
	getDs2(q = "", b, salt) {
		let i = Math.floor(Date.now() / 1000)
		let r = _.random(100001, 200000)
		let add = `&b=${b}&q=${q}`
		let c = md5("salt=" + salt + "&t=" + i + "&r=" + r + add)
		return `${i},${r},${c}`
	}

	getDs(salt = mys.saltWeb) {
		const randomStr = utils.randomString(6);
		const timestamp = Math.floor(Date.now() / 1000)
		let sign = md5(`salt=${salt}&t=${timestamp}&r=${randomStr}`);
		return `${timestamp},${randomStr},${sign}`
	}

	async getAgent() {
		if (isV3) {
			let cfg = await import(`file://${_path}/lib/config/config.js`);
			let proxyAddress = cfg.default.bot.proxyAddress
			if (!proxyAddress) return null
			if (proxyAddress === 'http://0.0.0.0:0') return null

			if (!this.isOs) return null

			if (HttpsProxyAgent === '') {
				HttpsProxyAgent = await import('https-proxy-agent').catch((err) => {
					logger.error(err)
				})

				HttpsProxyAgent = HttpsProxyAgent ? HttpsProxyAgent.default : undefined
			}
			if (HttpsProxyAgent) {
				return new HttpsProxyAgent(proxyAddress)
			}
		}
		return null
	}
}
