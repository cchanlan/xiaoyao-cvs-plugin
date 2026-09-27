const APP_VERSION = "2.70.1";
const salt = "S9Hrn38d2b55PamfIR9BNA3Tx9sQTOem"; //k2
const salt2 = "LyD1rXqMv2GJhnwdvCBjFOKGiKuLY3aO"; //x6
const saltWeb = "sjdNFJB7XxyDWGIAk0eTV8AOCfMJmyEo";//lk2
const passSalt = 'JwYDpKvLj6MrMqqYU6jTKF17KNO2PXoS';
const web_api = `https://api-takumi.mihoyo.com`
const os_web_api = `https://api-os-takumi.mihoyo.com`
const bbs_api = `https://bbs-api.mihoyo.com`;
const pass_api = `https://passport-api.mihoyo.com`
const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDDvekdPMHN3AYhm/vktJT+YJr7cI5DcsNKqdsx5DZX0gDuWFuIjzdwButrIYPNmRJ1G8ybDIF7oDW2eEpm5sMbL9zs
9ExXCdvqrn51qELbqj0XxtMTIpaCHFSI50PfPpTFV9Xt/hmyVwokoOXFlAEgCn+Q
CgGs52bFoYMtyi+xEQIDAQAB
-----END PUBLIC KEY-----`
// 只保留查询账号角色时需要区服信息的板块
const boards = {
	honkai3rd: {
		forumid: 1,
		key: 'honkai3rd',
		biz: 'bh3_cn',
		actid: 'e202207181446311',
		name: '崩坏3',
		url: "https://bbs.mihoyo.com/bh3/",
		getReferer() {
			return `https://webstatic.mihoyo.com/bh3/event/euthenia/index.html?bbs_presentation_style=fullscreen&bbs_game_role_required=${this.biz}&bbs_auth_required=true&act_id=${this.actid}&utm_source=bbs&utm_medium=mys&utm_campaign=icon`
		}
	},
	genShin: {
		forumid: 26,
		key: 'genshin',
		biz: 'hk4e_cn',
		osbiz: 'hk4e_global',
		actid: 'e202311201442471',
		name: '原神',
		url: "https://bbs.mihoyo.com/ys/",
		getReferer() {
			return `https://act.mihoyo.com/bbs/event/signin-ys/index.html?bbs_auth_required=true&act_id=${this.actid}&utm_source=bbs&utm_medium=mys&utm_campaign=icon`
		}
	},
	honkai2: {
		forumid: 30,
		biz: 'bh2_cn',
		actid: 'e202203291431091',
		name: '崩坏2',
		url: "https://bbs.mihoyo.com/bh2/",
		getReferer() {
			return `https://webstatic.mihoyo.com/bbs/event/signin/bh2/index.html?bbs_auth_required=true&act_id=${this.actid}&bbs_presentation_style=fullscreen&utm_source=bbs&utm_medium=mys&utm_campaign=icon`
		}
	},
	tears: {
		forumid: 37,
		biz: 'nxx_cn',
		name: '未定事件簿',
		actid: 'e202202251749321',
		url: "https://bbs.mihoyo.com/wd/",
		getReferer() {
			return `https://webstatic.mihoyo.com/bbs/event/signin/nxx/index.html?bbs_auth_required=true&bbs_presentation_style=fullscreen&act_id=${this.actid}`
		}
	},
	house: {
		forumid: 34,
		name: '大别野',
		url: "https://bbs.mihoyo.com/dby/",
	},
	honkaisr: {
		forumid: 52,
		name: '崩坏星穹铁道',
		actid: 'e202304121516551',
		biz: 'hkrpg_cn',
		osbiz: 'hkrpg_global',
		url: "https://bbs.mihoyo.com/sr/",
		getReferer() {
			return `https://webstatic.mihoyo.com/bbs/event/signin/hkrpg/index.html?bbs_auth_required=true&act_id=${this.actid}&bbs_auth_required=true&bbs_presentation_style=fullscreen&utm_source=h5&utm_medium=mys&utm_campaign=zj`
		}
	},
	zzz: {
		forumid: 57,
		name: "绝区零",
		url: "https://bbs.mihoyo.com/zzz/",
	}
}
export default {
	APP_VERSION,
	salt,
	salt2,
	saltWeb,
	web_api,
	os_web_api,
	pass_api,
	bbs_api,
	publicKey,
	passSalt,
	boards
}
