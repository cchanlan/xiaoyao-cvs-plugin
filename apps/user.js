import gsCfg from '../model/gsCfg.js';

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
