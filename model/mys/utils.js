import _ from 'lodash';
import moment from 'moment';

export async function sleepAsync(sleepms) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, sleepms)
	});
}

export function randomString(length, os = false) {
	let randomStr = '';
	for (let i = 0; i < length; i++) {
		randomStr += _.sample(os ? '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' :
			'abcdefghijklmnopqrstuvwxyz0123456789');
	}
	return randomStr;
}

export async function redisDel(userId, type = 'bbs') {
	return await redis.del(`xiaoyao:${type}:${userId}`)
}

export async function redisGet(userId, type = 'bbs') {
	return JSON.parse(await redis.get(`xiaoyao:${type}:${userId}`))
}

export async function redisSet(userId = "all", type = 'bbs', data, time = 0) {
	// 参数顺序必须是 (数字, 单位)：写成 add('days', 1) 在新版 moment 上会报 deprecation
	var dayTime = moment(Date.now()).add(1, 'days').format('YYYY-MM-DD 00:00:00')
	var new_date = (new Date(dayTime).getTime() - new Date().getTime()) / 1000 //获取隔天凌晨的时间差
	if (time !== 0) {
		new_date = time
	}
	return await redis.set(`xiaoyao:${type}:${userId}`, JSON.stringify(data), {
		EX: parseInt(new_date)
	});
}

export function getServer(uid) {
	switch (String(uid)[0]) {
		case '1':
		case '2':
			return 'cn_gf01' // 官服
		case '5':
			return 'cn_qd01' // B服
		case '6':
			return 'os_usa' // 美服
		case '7':
			return 'os_euro' // 欧服
		case '8':
			return 'os_asia' // 亚服
		case '9':
			return 'os_cht' // 港澳台服
	}
	return 'cn_gf01'
}

export async function getCookieMap(cookie) {
	let cookieArray = cookie.replace(/\s*/g, "").split(";");
	let cookieMap = new Map();
	for (let item of cookieArray) {
		let entry = item.replace('=', '~').split("~");
		if (!entry[0]) continue;
		cookieMap.set(entry[0], entry[1]);
	}
	return cookieMap || {};
}

/**
 * 延时撤回消息，用于二维码过期后自动清理
 * @param {e} e
 * @param {撤回的消息id} r
 * @param {多久撤回(秒)} times
 */
export function recallMsg(e, r, times) {
	setTimeout(() => {
		if (e?.group?.recallMsg && r?.message_id) {
			e?.group?.recallMsg(r?.message_id)
		} else if (e?.friend?.recallMsg && r?.message_id) {
			e?.friend?.recallMsg(r?.message_id)
		}
	}, 1000 * times)
}

export async function replyMake(e, _msg, lenght) {
	const bot = e.bot || Bot
	let nickname = bot.nickname;
	if (e.isGroup && bot.getGroupMemberInfo) try {
		const info = await bot.getGroupMemberInfo(e.group_id, bot.uin)
		nickname = info.card || info.nickname
	} catch {}
	let msgList = [];
	for (let [index, item] of Object.entries(_msg)) {
		if (index < lenght) {
			continue;
		}
		msgList.push({
			message: item,
			nickname: nickname,
			user_id: bot.uin
		})
	}
	if (e.isGroup) {
		msgList = await e.group.makeForwardMsg(msgList)
	} else {
		msgList = await e.friend.makeForwardMsg(msgList)
	}
	if (e._reply) {
		e._reply(msgList);
	} else {
		e.reply(msgList);
	}
}

export default {
	sleepAsync,
	replyMake,
	redisDel,
	getServer,
	randomString,
	redisGet,
	redisSet,
	recallMsg,
	getCookieMap
}
