import gsCfg from '../model/gsCfg.js';
import utils from '../model/mys/utils.js';
import { isV3 } from '../components/Changelog.js';
import User from '../model/user.js';

export const rule = {
	userInfo: {
		reg: "^#*(ck|stoken|cookie|cookies|签到|账号)查询$",
		describe: "查看已绑定的账号"
	},
	mytoken: {
		reg: "^#*我的(stoken|云ck)(\\s*\\d{6,})?$",
		describe: "查看绑定的 stoken"
	},
	delSign: {
		reg: "^#*删除(我的)*(stoken|sk)(\\s*\\d{6,})?$",
		describe: "删除已绑定的账号"
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

// ===== 从精简前版本搬回来的抽卡记录（原神） =====
let configData = gsCfg.getfileYaml(`${_path}/plugins/xiaoyao-cvs-plugin/config/`, 'config') || {};

export async function gclog(e) {
	let user = new User(e);
	// 精简版删掉了 user.cookie()（旧版用它刷新/补全 ck）；
	// 现在 miHoYoApi 的构造函数会自己从已绑定的 stoken 组装 cookies，这一步不再需要
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
	// e.reply(e.msg)
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
			let gclog = (await import(`file://${_path}/plugins/genshin/model/gachaLog.js`)).default
			await (new gclog(e)).logUrl()
		} else {
			let {
				bing
			} = (await import(`file://${_path}/lib/app/gachaLog.js`))
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

async function getAuthKey(e, user,data={
	auth_appid:'webview_gacha'
}) {
	if (!e.uid) {
		e.uid = e?.runtime?.user?._regUid
	}
	e.region = utils.getServer(e.uid)
	let authkeyrow = await user.getData("authKey", data);
	if (!authkeyrow?.data) {
		e.reply(`uid:${e.uid},authkey获取失败：` + (authkeyrow.message.includes("登录失效") ? "请重新绑定stoken" : authkeyrow.message))
		return false;
	}
	return authkeyrow.data["authkey"];
}
