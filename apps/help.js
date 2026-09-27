import lodash from "lodash";
import {
	currentVersion,
	changelogs
} from "../components/Changelog.js";
import Common from "../components/Common.js";
import fs from "fs"
const _path = process.cwd();

const helpPath = `${_path}/plugins/xiaoyao-cvs-plugin/resources/help`;
const path_ = `/plugins/xiaoyao-cvs-plugin/resources/common/layout/`;

// puppeteer 挂了时的文字兜底
const TEXT_HELP = [
	'【米游社扫码登录】',
	'#扫码登录 - 扫码绑定米游社账号',
	'#ck查询 - 查看已绑定的账号列表',
	'#我的stoken - 查看已绑定账号的登录凭证',
	'#删除stoken - 删除已绑定的账号，可跟 uid 指定',
	'#米游社版本 - 查看更新日志',
].join('\n');

export async function help(e, {
	render
}) {
	let custom = {},
		help = {};
	if (fs.existsSync(`${helpPath}/help-cfg.js`)) {
		help = await import(`file://${helpPath}/help-cfg.js?version=${new Date().getTime()}`);
	} else {
		help = await import(`file://${helpPath}/help-cfg_default.js?version=${new Date().getTime()}`);
	}

	// 兼容一下旧字段
	if (lodash.isArray(help.helpCfg)) {
		custom = {
			helpList: help.helpCfg,
			helpCfg: {}
		};
	} else {
		custom = help;
	}

	let def = await import(`file://${helpPath}/help-cfg_default.js?version=${new Date().getTime()}`);

	let helpCfg = lodash.defaults(custom.helpCfg, def.helpCfg);
	let helpList = custom.helpList || def.helpList;

	let helpGroup = [];

	lodash.forEach(helpList, (group) => {
		if (group.auth && group.auth === "master" && !e.isMaster) {
			return;
		}

		lodash.forEach(group.list, (help) => {
			let icon = help.icon * 1;
			if (!icon) {
				help.css = `display:none`;
			} else {
				let x = (icon - 1) % 10,
					y = (icon - x - 1) / 10;
				help.css = `background-position:-${x * 50}px -${y * 50}px`;
			}

		});

		helpGroup.push(group);
	});

	try {
		return await Common.render_path("help/index", {
			helpCfg,
			helpGroup,
			element: 'default'
		}, {
			e,
			render,
			scale: 1.2
		}, path_)
	} catch (err) {
		logger.error(`[米游社插件] 帮助图渲染失败：${err}`)
		e.reply(TEXT_HELP)
		return true
	}
}

export async function versionInfo(e, {
	render
}) {
	return await Common.render_path("help/version-info", {
		currentVersion,
		changelogs,
		elem: "cryo",
	}, {
		e,
		render,
		scale: 1.2
	}, path_)
}
