import YAML from 'yaml'
import fs from 'node:fs'
import {
	isV3
} from '../components/Changelog.js';
const plugin = "xiaoyao-cvs-plugin"
/**
 * 配置文件与账号数据
 *
 * 两类数据：
 * - `plugins/xiaoyao-cvs-plugin/data/yaml/<QQ>.yaml` —— 本插件自己的 stoken（扫码登录写入）
 * - `data/MysCookie/<QQ>.yaml` —— **genshin 插件的 ck 绑定库**，只读（抽卡记录 / 扫码登录都要用它取 uid）
 */
const _path = process.cwd();
class GsCfg {
	constructor() {

	}
	/** 通用yaml读取*/
	getfileYaml(path, name) {
		this.cpCfg('config', 'config')
		return YAML.parse(
			fs.readFileSync(path + name + ".yaml", 'utf8')
		)
	}
	cpCfg(app, name) {
		if (!fs.existsSync(`./plugins/${plugin}/config`)) {
			fs.mkdirSync(`./plugins/${plugin}/config`)
		}

		let set = `./plugins/${plugin}/config/${name}.yaml`
		if (!fs.existsSync(set)) {
			fs.copyFileSync(`./plugins/${plugin}/defSet/${app}/${name}.yaml`, set)
		}
	}

	/** 读 genshin 侧的 ck 绑定库（只读，不写） */
	getBingCookie(userId) {
		let file = `./data/MysCookie/${userId}.yaml`
		try {
			let ck = fs.readFileSync(file, 'utf-8')
			ck = YAML.parse(ck)
			for (let item in ck) {
				let login_ticket;
				if (!ck[item].isMain) {
					continue;
				}
				login_ticket = ck[item]?.login_ticket
				ck = ck[item].ck
				return {
					ck,
					item,
					login_ticket
				};
			}
		} catch (error) {
			return {}
		}
	}

	/**
	 * 取某个游戏 uid 对应的通行证 id（ltuid）
	 *
	 * genshin 绑定库里一个通行证会挂多个角色，本插件 yaml 按角色 uid 存。
	 * 凭证失效要按**通行证**删（同通行证的其它角色也一起失效），所以先在这里做 uid → ltuid 的换算。
	 * 传 uid 取不到时回落到 isMain 那条；都取不到返回空串。
	 */
	getBingLtuid(userId, uid = '') {
		let file = `./data/MysCookie/${userId}.yaml`
		try {
			let ck = YAML.parse(fs.readFileSync(file, 'utf-8')) || {}
			if (uid && ck[String(uid)]?.ltuid) return String(ck[String(uid)].ltuid)
			for (let k in ck) {
				if (ck[k]?.isMain && ck[k]?.ltuid) return String(ck[k].ltuid)
			}
		} catch (error) {
			// 没装 genshin / 没绑定，返回空串由调用方降级
		}
		return ''
	}

	/** 读取单个用户绑定的 stoken */
	async getUserStoken(userId) {
		try {
			let ck = YAML.parse(
				fs.readFileSync(`plugins/${plugin}/data/yaml/${userId}.yaml`, 'utf8')
			)
			return ck || {}
		} catch (ex) {
			return {}
		}
	}
	/**
	 * 合并写入账号数据（按 uid 逐条更新，已存在的 uid 覆盖，其余保留）
	 * 用于扫码绑定：一次只会拿到一个账号，不能把别的账号冲掉
	 * @param {string} userId QQ号
	 * @param {object} data 形如 { uid: { stuid, stoken, ltoken, ... } }
	 */
	saveBingStoken(userId, data) {
		if (!data || Object.keys(data).length === 0) return;
		let file = `./plugins/${plugin}/data/yaml/${userId}.yaml`
		let ck = GsCfg._read(file)
		//老格式（uid 在顶层）或空文件：直接覆盖
		if (!ck || ck?.uid) {
			GsCfg._write(file, data)
			return;
		}
		for (let uid of Object.keys(data)) {
			ck[uid] = data[uid]
		}
		GsCfg._write(file, ck)
	}

	/**
	 * 全量覆盖写入，传空对象表示删除该用户的整个文件
	 * 用于删除账号：以传入的数据为准，文件里多出来的账号要被清掉
	 * @param {string} userId QQ号
	 * @param {object} data 形如 { uid: { stuid, stoken, ltoken, ... } }
	 */
	replaceStoken(userId, data) {
		let file = `./plugins/${plugin}/data/yaml/${userId}.yaml`
		if (!data || Object.keys(data).length === 0) {
			fs.existsSync(file) && fs.unlinkSync(file)
			return;
		}
		GsCfg._write(file, data)
	}

	/** 读账号文件，读不出（不存在/损坏）返回 null */
	static _read(file) {
		try {
			return YAML.parse(fs.readFileSync(file, 'utf-8')) || null
		} catch (e) {
			return null
		}
	}

	/** 写账号文件，自动建目录 */
	static _write(file, data) {
		let dir = file.replace(/\/[^/]+$/, '')
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
		fs.writeFileSync(file, YAML.stringify(data), 'utf8')
	}
}


export default new GsCfg()
